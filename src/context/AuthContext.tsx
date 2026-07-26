import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getUserProfile, getUserProfileOrNull } from "../services/authService";
import { AppUser } from "../types/user";
import { cache, cacheKeys } from "../utils/cache";

interface AuthContextType {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  /** Authenticated with Firebase but no Firestore profile yet (needs role selection). */
  isOnboarding: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserProfile = async () => {
    if (!firebaseUser) return;
    
    try {
      const profile = await getUserProfile(firebaseUser.uid);
      setAppUser(profile as AppUser);
    } catch {
      // Profile refresh failed; ignore
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Add a delay to allow sign-out operations to complete
      // This needs to be longer to ensure auth service sign-outs complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Re-check the current user after the delay
      const currentUser = auth.currentUser;
      
      setFirebaseUser(currentUser);

      if (currentUser) {
        // Fetch the profile. A missing profile is NOT an error here: it means the
        // user has authenticated but hasn't completed onboarding (role selection).
        // Only transient read failures are retried.
        let profile: AppUser | null = null;
        let retries = 3;

        while (retries > 0) {
          try {
            profile = (await getUserProfileOrNull(currentUser.uid)) as AppUser | null;
            break;
          } catch {
            retries--;
            if (retries > 0) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        }

        // profile === null → onboarding (keep the user signed in so they can
        // choose a role); a real profile → fully onboarded.
        setAppUser(profile);
      } else {
        setAppUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Set up real-time listener for user profile changes
  useEffect(() => {
    if (!firebaseUser) return;

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const updatedUser = {
          uid: snapshot.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as AppUser;
        
        setAppUser(updatedUser);
        
        // Invalidate artwork caches to refetch with new avatar
        cache.invalidate(cacheKeys.artworks(20));
        cache.invalidate(cacheKeys.artworks(50));
        if (firebaseUser.uid) {
          cache.invalidate(cacheKeys.favoriteArtworks(firebaseUser.uid));
          cache.invalidate(cacheKeys.publishedWorks(firebaseUser.uid));
          cache.invalidate(cacheKeys.galleryWorks(firebaseUser.uid));
        }
      }
    });

    return unsubscribe;
  }, [firebaseUser]);

  const isOnboarding = firebaseUser !== null && appUser === null;

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading, isOnboarding, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
