import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  UserCredential,
  User,
} from "firebase/auth";
import { isNativeApp } from "../utils/platform";
import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, getDocs, deleteDoc, writeBatch, increment } from "firebase/firestore";
import { getStorage, ref, deleteObject, listAll } from "firebase/storage";
import { UserRole } from "../types/user";
import { cache } from "../utils/cache";
import {
  setAuthFlow,
  clearAuthFlow,
  setPendingGoogleNoAccount,
  setAuthHold,
  clearAuthHold,
} from "../utils/authFlow";

export async function login(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
  return userCredential.user;
}

async function signOutNativeGoogleIfNeeded(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { FirebaseAuthentication } = await import(
      "@capacitor-firebase/authentication"
    );
    await FirebaseAuthentication.signOut();
  } catch {
    // Native session may already be cleared.
  }
}

/** Sign out JS Auth + native Google session (Capacitor). */
async function completeSignOut(delayMs = 300): Promise<void> {
  await signOutNativeGoogleIfNeeded();
  await signOut(auth);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

export async function logout() {
  // Clear all cached data
  cache.clear();
  
  // Clear auth state
  await completeSignOut(300);
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
    // Check user's last sign-in time
    const lastSignInTime = user.metadata.lastSignInTime;
    if (lastSignInTime) {
      const lastSignIn = new Date(lastSignInTime);
      const now = new Date();
      const hoursSinceSignIn = (now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60);
      
      // Firebase typically requires reauth after 5-10 minutes for sensitive operations
      // We'll be conservative and require reauth if more than 5 minutes
      if (hoursSinceSignIn > 0.083) { // 5 minutes = 0.083 hours
        const reAuthError: any = new Error("REQUIRES_REAUTH");
        reAuthError.provider = provider;
        throw reAuthError;
      }
    }
  }

  // Handle reauthentication if forceDelete is true (user clicked reauth modal)
  if (forceDelete) {
    // For Google users, skip reauth here since it's done in the caller to avoid popup blockers
    // For password users, do reauth here with the provided password
    if (provider !== "google") {
      if (password) {
        try {
          if (!user.email) {
            throw new Error("User email not available");
          }
          const credential = EmailAuthProvider.credential(user.email, password);
          await reauthenticateWithCredential(user, credential);
        } catch (error: any) {
          throw error;
        }
      } else {
        throw new Error("NEEDS_PASSWORD");
      }
    }
  }

  try {
    // STEP 1: Delete all Firestore data
    const batch = writeBatch(db);

    // Get all artworks to delete their storage files
    const artworksQuery = query(
      collection(db, "artworks"),
      where("artistId", "==", userId)  // Changed from userId to artistId
    );
    const artworksSnapshot = await getDocs(artworksQuery);
    const artworkImageUrls: string[] = [];
    
    artworksSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.images && Array.isArray(data.images)) {
        artworkImageUrls.push(...data.images);
      }
      batch.delete(doc.ref);
    });

    // Delete user's stories
    const storiesQuery = query(
      collection(db, "stories"),
      where("userId", "==", userId)
    );
    const storiesSnapshot = await getDocs(storiesQuery);
    storiesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user's likes
    const likesQuery = query(
      collection(db, "likes"),
      where("userId", "==", userId)
    );
    const likesSnapshot = await getDocs(likesQuery);
    likesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user's favorites
    const favoritesQuery = query(
      collection(db, "favorites"),
      where("userId", "==", userId)
    );
    const favoritesSnapshot = await getDocs(favoritesQuery);
    favoritesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    const ownArtworkIds = new Set(artworksSnapshot.docs.map((d) => d.id));
    const commentsQuery = query(
      collection(db, "comments"),
      where("userId", "==", userId)
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    const countsByArtwork = new Map<string, number>();
    commentsSnapshot.docs.forEach((d) => {
      const aid = d.data().artworkId as string | undefined;
      if (aid) {
        countsByArtwork.set(aid, (countsByArtwork.get(aid) || 0) + 1);
      }
    });

    const commentDocs = commentsSnapshot.docs;
    const COMMENT_CHUNK = 400;
    for (let i = 0; i < commentDocs.length; i += COMMENT_CHUNK) {
      const commentBatch = writeBatch(db);
      commentDocs.slice(i, i + COMMENT_CHUNK).forEach((docSnap) => {
        commentBatch.delete(docSnap.ref);
      });
      await commentBatch.commit();
    }

    if (countsByArtwork.size > 0) {
      const decBatch = writeBatch(db);
      countsByArtwork.forEach((count, aid) => {
        if (!ownArtworkIds.has(aid)) {
          decBatch.update(doc(db, "artworks", aid), { comments: increment(-count) });
        }
      });
      await decBatch.commit();
    }

    // Delete follows where user is following others
    const followingQuery = query(
      collection(db, "follows"),
      where("followerId", "==", userId)
    );
    const followingSnapshot = await getDocs(followingQuery);
    followingSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete follows where others are following user
    const followersQuery = query(
      collection(db, "follows"),
      where("artistId", "==", userId)
    );
    const followersSnapshot = await getDocs(followersQuery);
    followersSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user profile document
    batch.delete(doc(db, "users", userId));

    // Commit all Firestore deletions
    await batch.commit();

    // STEP 2: Delete Storage files (artwork images)
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
        } else {
          failedImagesCount++;
        }
      } catch (error: any) {
        failedImagesCount++;
        // Continue even if some images fail to delete
      }
    }

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
    } catch {
      // Continue even if folder deletion fails
    }

    // STEP 3: Delete Firebase Auth account (LAST)
    await deleteUser(user);
  } catch (error: any) {
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

/**
 * Like getUserProfile, but returns null when the profile document does not exist
 * (instead of throwing). Real errors (network/permission) still throw so callers
 * can distinguish "genuinely no profile yet" from "couldn't read".
 */
export async function getUserProfileOrNull(uid: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data();
  if (data.createdAt && typeof data.createdAt.toDate === 'function') {
    data.createdAt = data.createdAt.toDate();
  }
  return data;
}

/**
 * Register a new Email/Password user with Firebase Auth ONLY.
 * The Firestore profile is created later, after role selection, via createUserProfile().
 */
export async function registerWithEmail(
  name: string,
  email: string,
  password: string
): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    try {
      await updateProfile(userCredential.user, { displayName: name });
    } catch {
      // Non-fatal: name is also persisted on the Firestore profile later.
    }
  }
  return userCredential.user;
}

/**
 * Create the Firestore user profile for the currently authenticated user.
 * Called after role selection (and, for artists, after username creation).
 * Never overwrites an existing profile.
 */
export async function createUserProfile(params: {
  role: UserRole;
  username?: string;
  name?: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    // Guard against races/duplicate submits: returning users keep their profile.
    return;
  }

  const provider = user.providerData.some((p) => p.providerId === "google.com")
    ? "google"
    : "password";

  const userData: Record<string, unknown> = {
    uid: user.uid,
    name: params.name || user.displayName || "",
    email: user.email,
    role: params.role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    provider,
    passwordPolicyVersion: 2,
  };

  if (params.role === "artist") {
    userData.isFoundingArtist = false;
    if (params.username) {
      userData.username = params.username.toLowerCase();
    }
  }

  await setDoc(userRef, userData);
}

export interface GoogleSignInOptions {
  /** Force Google to show the account chooser instead of reusing the active session. */
  forceAccountPicker?: boolean;
  /** Pre-select an account in the Google chooser. */
  loginHint?: string;
}

/**
 * Obtain a Google sign-in against the Firebase JS SDK.
 * - Web: popup flow (unchanged).
 * - Native (Capacitor): use the native Google account picker via
 *   @capacitor-firebase/authentication to get an ID token, then sign in to the
 *   JS SDK with that credential so the rest of the app (Firestore, rules, etc.)
 *   sees a normal Firebase user. Requires google-services.json + a SHA-1/SHA-256
 *   fingerprint registered in the Firebase console for the Android app.
 */
async function googleSignInCredential(
  options: GoogleSignInOptions = {}
): Promise<UserCredential> {
  if (!isNativeApp()) {
    const provider = new GoogleAuthProvider();
    const customParameters: Record<string, string> = {};
    if (options.forceAccountPicker) {
      customParameters.prompt = "select_account";
    }
    if (options.loginHint) {
      customParameters.login_hint = options.loginHint;
    }
    if (Object.keys(customParameters).length > 0) {
      provider.setCustomParameters(customParameters);
    }
    return signInWithPopup(auth, provider);
  }

  const { FirebaseAuthentication } = await import(
    "@capacitor-firebase/authentication"
  );
  const nativeResult = await FirebaseAuthentication.signInWithGoogle();
  const idToken = nativeResult.credential?.idToken;
  if (!idToken) {
    throw new Error("Google sign-in did not return an ID token.");
  }
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export interface GoogleAuthOutcome {
  user: User;
  /** Whether a Firestore profile already exists for this account. */
  profileExists: boolean;
}

/**
 * Authenticate with Google against Firebase Auth ONLY.
 * - Does NOT create a Firestore profile.
 * - Leaves the user signed in (so onboarding can continue).
 * - Throws "ACCOUNT_EXISTS_WITH_PASSWORD" if the email is already a password account.
 */
export async function authenticateWithGoogle(
  options: GoogleSignInOptions = {}
): Promise<GoogleAuthOutcome> {
  // Hold /home redirects until we finish password-conflict checks (and sign out if needed).
  setAuthHold();
  let user: User;

  try {
    try {
      const result = await googleSignInCredential(options);
      user = result.user;
    } catch (error: any) {
      await signOutNativeGoogleIfNeeded();
      if (error.code === "auth/account-exists-with-different-credential") {
        const email = error.customData?.email || error.email;
        if (email) {
          try {
            const signInMethods = await fetchSignInMethodsForEmail(auth, email);
            if (signInMethods.includes("password")) {
              throw new Error("ACCOUNT_EXISTS_WITH_PASSWORD");
            }
          } catch (fetchError: any) {
            if (fetchError.message === "ACCOUNT_EXISTS_WITH_PASSWORD") {
              throw fetchError;
            }
            throw error;
          }
        }
      }
      throw error;
    }

    // Reject Google when this email already has a password-based BrushOwl profile
    // (own doc or another uid). Sign out before releasing the hold so routing never
    // treats this session as a successful login.
    if (user.email) {
      const profileSnapEarly = await getDoc(doc(db, "users", user.uid));
      if (profileSnapEarly.exists() && profileSnapEarly.data()?.provider === "password") {
        await completeSignOut(800);
        throw new Error("ACCOUNT_EXISTS_WITH_PASSWORD");
      }

      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("email", "==", user.email),
        where("provider", "==", "password")
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        await completeSignOut(800);
        throw new Error("ACCOUNT_EXISTS_WITH_PASSWORD");
      }
    }

    const profileSnap = await getDoc(doc(db, "users", user.uid));
    return { user, profileExists: profileSnap.exists() };
  } catch (error) {
    // Keep hold for password conflicts until Login/SignUp handles the error —
    // AuthContext may still briefly report the signed-in user after signOut.
    const isPasswordConflict =
      error instanceof Error && error.message.includes("ACCOUNT_EXISTS_WITH_PASSWORD");
    if (!isPasswordConflict) {
      clearAuthHold();
    }
    throw error;
  }
}

/**
 * SIGN IN with Google. If no Firestore profile exists, the user is signed out
 * again and "NO_ACCOUNT" is thrown (with .email/.displayName) so the caller can
 * confirm before creating a new account. This prevents accidental duplicates and
 * ensures onboarding never auto-starts from the sign-in screen.
 */
export async function signInWithGoogle(
  options: GoogleSignInOptions = {}
): Promise<User> {
  // Prevent App from treating the brief signed-in-no-profile window as onboarding.
  setAuthFlow("signin");

  try {
    const { user, profileExists } = await authenticateWithGoogle(options);

    if (!profileExists) {
      const email = user.email ?? "";
      const displayName = user.displayName ?? "";
      // Persist before sign-out so Login can show the modal even if it remounts.
      setPendingGoogleNoAccount(email, displayName);
      await completeSignOut(300);
      if (auth.currentUser !== null) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      clearAuthHold();
      const noAccountError: any = new Error("NO_ACCOUNT");
      noAccountError.email = email;
      noAccountError.displayName = displayName;
      throw noAccountError;
    }

    clearAuthHold();
    clearAuthFlow();
    return user;
  } catch (error) {
    const isNoAccount = error instanceof Error && error.message.includes("NO_ACCOUNT");
    const isPasswordConflict =
      error instanceof Error && error.message.includes("ACCOUNT_EXISTS_WITH_PASSWORD");
    // Password conflict: leave hold up until Login clears it after showing the toast.
    if (!isPasswordConflict) {
      clearAuthHold();
    }
    // Keep authFlow=signin + pending flag until Login consumes the modal.
    if (!isNoAccount) {
      clearAuthFlow();
    }
    throw error;
  }
}

/**
 * SIGN UP with Google. Authenticates and stays signed in even when no profile
 * exists yet, so the caller can continue into role selection. Returns whether a
 * profile already existed (returning user).
 */
export async function signUpWithGoogle(
  options: GoogleSignInOptions = {}
): Promise<GoogleAuthOutcome> {
  setAuthFlow("onboarding");
  try {
    const outcome = await authenticateWithGoogle(options);
    clearAuthHold();
    if (outcome.profileExists) {
      clearAuthFlow();
    }
    return outcome;
  } catch (error) {
    const isPasswordConflict =
      error instanceof Error && error.message.includes("ACCOUNT_EXISTS_WITH_PASSWORD");
    if (!isPasswordConflict) {
      clearAuthHold();
    }
    clearAuthFlow();
    throw error;
  }
}

