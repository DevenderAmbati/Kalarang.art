import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ReactElement } from "react";

export default function ProtectedRoute({
  children,
}: {
  children: ReactElement;
}) {
  const { firebaseUser, appUser, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!firebaseUser || !appUser) {
    return <Navigate to="/" replace />;
  }

  return children;
}
