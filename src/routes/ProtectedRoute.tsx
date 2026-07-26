import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ReactElement } from "react";
import {
  shouldSuppressOnboardingRedirect,
  peekPendingGoogleNoAccount,
  shouldSuppressAuthHomeRedirect,
} from "../utils/authFlow";

export default function ProtectedRoute({
  children,
}: {
  children: ReactElement;
}) {
  const { firebaseUser, appUser, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  // Google auth still verifying (e.g. password conflict) — stay out of the app.
  if (shouldSuppressAuthHomeRedirect()) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but no profile yet → finish onboarding (role selection),
  // unless Sign In is mid "no account" confirmation (must not auto-onboard).
  if (firebaseUser && !appUser) {
    if (shouldSuppressOnboardingRedirect()) {
      return <Navigate to={peekPendingGoogleNoAccount() ? "/login" : "/signup"} replace />;
    }
    return <Navigate to="/select-role" replace />;
  }

  if (!firebaseUser || !appUser) {
    return <Navigate to="/" replace />;
  }

  if (
    appUser.provider === "password" &&
    (!appUser.passwordPolicyVersion || appUser.passwordPolicyVersion < 2)
  ) {
    return <Navigate to="/update-password" replace />;
  }

  return children;
}
