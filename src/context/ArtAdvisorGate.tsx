import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

const ArtAdvisorWidget = React.lazy(() => import("../components/ArtAdvisor/ArtAdvisorWidget"));

const HIDDEN_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/create-username", "/update-password"];

const ArtAdvisorGate: React.FC = () => {
  const { appUser } = useAuth();
  const location = useLocation();

  if (!appUser) return null;
  if (appUser.role === "artist") return null;
  if (HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <React.Suspense fallback={null}>
      <ArtAdvisorWidget />
    </React.Suspense>
  );
};

export default ArtAdvisorGate;
