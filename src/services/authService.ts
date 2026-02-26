import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, getDocs, deleteDoc, writeBatch } from "firebase/firestore";
import { getStorage, ref, deleteObject, listAll } from "firebase/storage";
import { UserRole } from "../types/user";

export async function signup(
  name: string,
  email: string,
  password: string,
  role: UserRole
) {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  const user = userCredential.user;

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name,
    email,
    role,
    createdAt: serverTimestamp(),
    provider: "password",
    passwordPolicyVersion: 2,
  });

  return user;
}

export async function login(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
  return userCredential.user;
}

export async function logout() {
  // Clear session storage for WhatsApp modal dismissal
  const keysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('whatsapp_dismissed_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => sessionStorage.removeItem(key));
  
  await signOut(auth);
}

/**
 * Delete user account and all associated data
 * Flow:
 * 1. FIRST: Check if reauthentication is needed (if not forced)
 * 2. If reauth needed → throw error to show modal
 * 3. If forced (after reauth) OR recent login → delete in order:
 *    a) Firestore data (profile, artworks, stories, likes, favorites, follows)
 *    b) Storage files (artwork images)
 *    c) Firebase Auth account
 * 
 * @param userId - The user ID to delete
 * @param password - Password for email/password accounts (only for reauthentication)
 * @param forceDelete - User already confirmed reauth, proceed with actual reauthentication
 */
export async function deleteAccount(userId: string, password?: string, forceDelete: boolean = false) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No user is currently signed in");
  }

  // Get user's authentication provider
  const userDoc = await getDoc(doc(db, "users", userId));
  const provider = userDoc.data()?.provider;

  // STEP 0: Check if reauthentication is needed (BEFORE any deletion)
  if (!forceDelete) {
    console.log("Checking if reauthentication is required...");
    
    // Check user's last sign-in time
    const lastSignInTime = user.metadata.lastSignInTime;
    if (lastSignInTime) {
      const lastSignIn = new Date(lastSignInTime);
      const now = new Date();
      const hoursSinceSignIn = (now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60);
      
      console.log(`Hours since last sign-in: ${hoursSinceSignIn}`);
      
      // Firebase typically requires reauth after 5-10 minutes for sensitive operations
      // We'll be conservative and require reauth if more than 5 minutes
      if (hoursSinceSignIn > 0.083) { // 5 minutes = 0.083 hours
        console.log("Reauthentication required (last sign-in too old)");
        const reAuthError: any = new Error("REQUIRES_REAUTH");
        reAuthError.provider = provider;
        throw reAuthError;
      }
    }
  }

  // Handle reauthentication if forceDelete is true (user clicked reauth modal)
  if (forceDelete) {
    console.log("Force delete flag is true, checking if reauthentication needed...");
    
    // For Google users, skip reauth here since it's done in the caller to avoid popup blockers
    // For password users, do reauth here with the provided password
    if (provider !== "google") {
      if (password) {
        console.log("Performing password reauthentication...");
        try {
          if (!user.email) {
            throw new Error("User email not available");
          }
          const credential = EmailAuthProvider.credential(user.email, password);
          await reauthenticateWithCredential(user, credential);
          console.log("Password reauthentication successful");
        } catch (error: any) {
          console.error("Reauthentication error:", error);
          throw error;
        }
      } else {
        throw new Error("NEEDS_PASSWORD");
      }
    } else {
      console.log("Google user - reauthentication should have been done in caller");
    }
  }

  try {
    // STEP 1: Delete all Firestore data
    console.log("Step 1: Deleting Firestore data...");
    const batch = writeBatch(db);

    // Get all artworks to delete their storage files
    const artworksQuery = query(
      collection(db, "artworks"),
      where("artistId", "==", userId)  // Changed from userId to artistId
    );
    const artworksSnapshot = await getDocs(artworksQuery);
    const artworkImageUrls: string[] = [];
    
    console.log(`Found ${artworksSnapshot.docs.length} artworks to delete`);
    
    artworksSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`Deleting artwork: ${doc.id} - ${data.title}`);
      if (data.images && Array.isArray(data.images)) {
        console.log(`  Found ${data.images.length} images for this artwork`);
        artworkImageUrls.push(...data.images);
      }
      batch.delete(doc.ref);
    });

    console.log(`Total images to delete from storage: ${artworkImageUrls.length}`);

    // Delete user's stories
    const storiesQuery = query(
      collection(db, "stories"),
      where("userId", "==", userId)
    );
    const storiesSnapshot = await getDocs(storiesQuery);
    console.log(`Found ${storiesSnapshot.docs.length} stories to delete`);
    storiesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user's likes
    const likesQuery = query(
      collection(db, "likes"),
      where("userId", "==", userId)
    );
    const likesSnapshot = await getDocs(likesQuery);
    console.log(`Found ${likesSnapshot.docs.length} likes to delete`);
    likesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user's favorites
    const favoritesQuery = query(
      collection(db, "favorites"),
      where("userId", "==", userId)
    );
    const favoritesSnapshot = await getDocs(favoritesQuery);
    console.log(`Found ${favoritesSnapshot.docs.length} favorites to delete`);
    favoritesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete follows where user is following others
    const followingQuery = query(
      collection(db, "follows"),
      where("followerId", "==", userId)
    );
    const followingSnapshot = await getDocs(followingQuery);
    console.log(`Found ${followingSnapshot.docs.length} following to delete`);
    followingSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete follows where others are following user
    const followersQuery = query(
      collection(db, "follows"),
      where("artistId", "==", userId)
    );
    const followersSnapshot = await getDocs(followersQuery);
    console.log(`Found ${followersSnapshot.docs.length} followers to delete`);
    followersSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user profile document
    batch.delete(doc(db, "users", userId));

    // Commit all Firestore deletions
    await batch.commit();
    console.log("Firestore data deleted successfully");

    // STEP 2: Delete Storage files (artwork images)
    console.log("Step 2: Deleting storage files...");
    console.log(`Attempting to delete ${artworkImageUrls.length} images from storage`);
    const storage = getStorage();
    
    let deletedImagesCount = 0;
    let failedImagesCount = 0;
    
    // Delete artwork images from URLs
    for (const imageUrl of artworkImageUrls) {
      try {
        // Extract path from Firebase Storage URL
        const urlPath = imageUrl.split('/o/')[1]?.split('?')[0];
        if (urlPath) {
          const decodedPath = decodeURIComponent(urlPath);
          const imageRef = ref(storage, decodedPath);
          await deleteObject(imageRef);
          deletedImagesCount++;
          console.log(`  ✓ Deleted: ${decodedPath}`);
        } else {
          console.log(`  ✗ Could not extract path from URL: ${imageUrl}`);
          failedImagesCount++;
        }
      } catch (error: any) {
        console.error(`  ✗ Error deleting image:`, error.code, error.message);
        failedImagesCount++;
        // Continue even if some images fail to delete
      }
    }
    
    console.log(`Storage deletion summary: ${deletedImagesCount} deleted, ${failedImagesCount} failed`);

    // Also try to delete user's profile avatar and banner if they exist
    try {
      const avatarRef = ref(storage, `avatars/${userId}`);
      await deleteObject(avatarRef);
    } catch (error) {
      // Avatar might not exist, that's okay
    }

    try {
      const bannerRef = ref(storage, `banners/${userId}`);
      await deleteObject(bannerRef);
    } catch (error) {
      // Banner might not exist, that's okay
    }

    // Try to delete entire user folder if it exists
    try {
      const userFolderRef = ref(storage, `users/${userId}`);
      const userFiles = await listAll(userFolderRef);
      
      // Delete all files in user folder
      for (const item of userFiles.items) {
        await deleteObject(item);
      }
      
      // Delete all files in subfolders
      for (const folder of userFiles.prefixes) {
        const folderFiles = await listAll(folder);
        for (const item of folderFiles.items) {
          await deleteObject(item);
        }
      }
    } catch (error) {
      console.error("Error deleting user folder:", error);
      // Continue even if folder deletion fails
    }

    console.log("Storage files deleted successfully");

    // STEP 3: Delete Firebase Auth account (LAST)
    console.log("Step 3: Deleting auth account...");
    await deleteUser(user);
    console.log(`Successfully deleted account for user: ${userId}`);
  } catch (error: any) {
    console.error("Error deleting account:", error);
    
    // Handle specific Firebase errors
    if (error.code === "auth/requires-recent-login") {
      // This shouldn't happen since we checked upfront, but handle it just in case
      const reAuthError: any = new Error("REQUIRES_REAUTH");
      reAuthError.provider = provider;
      throw reAuthError;
    } else if (error.code === "auth/wrong-password") {
      throw new Error("Incorrect password. Please try again.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed attempts. Please try again later.");
    } else if (error.message === "NEEDS_PASSWORD") {
      throw error; // Pass through for caller to handle
    }
    
    throw new Error(`Failed to delete account: ${error.message}`);
  }
}

export async function getUserProfile(uid: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("User profile not found");
  }

  const data = snap.data();
  
  // Convert Firestore timestamp to Date object
  if (data.createdAt && typeof data.createdAt.toDate === 'function') {
    data.createdAt = data.createdAt.toDate();
  }
  
  return data;
}

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(defaultRole?: "artist" | "buyer") {
  let result;
  let user;
  
  try {
    result = await signInWithPopup(auth, googleProvider);
    user = result.user;

    // Check if this email already exists with a password-based account in Firestore
    if (user.email) {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", user.email), where("provider", "==", "password"));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Email exists with password provider - prevent Google login
        // Sign out immediately and wait for it to complete
        await signOut(auth);
        // Wait for auth state to fully update - increased to ensure complete sign-out
        await new Promise(resolve => setTimeout(resolve, 1000));
        throw new Error("ACCOUNT_EXISTS_WITH_PASSWORD");
      }
    }

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    // Login flow, but no Firestore user exists
    if (!snap.exists() && !defaultRole) {
      // Sign out the user immediately to prevent auto-creation
      await signOut(auth);
      // Wait for auth state to fully update
      await new Promise(resolve => setTimeout(resolve, 800));
      // Verify sign out completed
      if (auth.currentUser !== null) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      throw new Error("NO_ACCOUNT");
    }

    // Signup flow but account already exists
    if (snap.exists() && defaultRole) {
      // Sign out the user to prevent automatic login
      await signOut(auth);
      // Wait for auth state to fully update
      await new Promise(resolve => setTimeout(resolve, 800));
      // Verify sign out completed
      if (auth.currentUser !== null) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      throw new Error("ACCOUNT_EXISTS");
    }

    // Signup flow - create new account
    if (!snap.exists() && defaultRole) {
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email,
        role: defaultRole,
        createdAt: serverTimestamp(),
        provider: "google",
        passwordPolicyVersion: 2,
      });
    }

    return user;
  } catch (error: any) {
    // Check if the error is because account exists with different credential
    if (error.code === "auth/account-exists-with-different-credential") {
      // Get the email from the error
      const email = error.customData?.email || error.email;
      
      if (email) {
        try {
          // Check what sign-in methods are available for this email
          const signInMethods = await fetchSignInMethodsForEmail(auth, email);
          
          if (signInMethods.includes("password")) {
            throw new Error("ACCOUNT_EXISTS_WITH_PASSWORD");
          }
        } catch (fetchError: any) {
          // If fetchError is our custom error, re-throw it
          if (fetchError.message === "ACCOUNT_EXISTS_WITH_PASSWORD") {
            throw fetchError;
          }
          // Otherwise throw the original error
          throw error;
        }
      }
    }
    
    // Re-throw the error for other cases
    throw error;
  }
}

