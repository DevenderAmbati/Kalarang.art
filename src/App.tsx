import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useEffect, useMemo, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './toastStyles.css';
import Layout from "./components/Layout/Layout";
import Home from "./pages/landing/Home";
import About from "./pages/landing/About";
import TermsOfService from "./pages/landing/TermsOfService";
import PrivacyPolicy from "./pages/landing/PrivacyPolicy";
import Login from "./pages/auth/Login";
import SignUp from "./pages/auth/SignUp";
import ResetPassword from "./pages/auth/ResetPassword";
import SetNewPassword from "./pages/auth/SetNewPassword";
import UpdatePassword from "./pages/auth/UpdatePassword";
import Upload from "./pages/artwork/Upload";
import HomeFeed from "./pages/feed/HomeFeed";
import Discover from "./pages/feed/Discover";
import Favourites from "./pages/user/Favourites";
import Portfolio from "./pages/user/Portfolio";
import OtherUserPortfolio from "./pages/user/OtherUserPortfolio";
import Profile from "./pages/user/Profile";
import Commissions from "./pages/user/Commissions";
import AccountHub from "./pages/user/AccountHub";
import CardDetail from "./pages/artwork/CardDetail";
import CreateUsername from "./pages/auth/CreateUsername";
import Explore from "./pages/feed/Explore";

import ProtectedRoute from "./routes/ProtectedRoute";
import { PermissionGuard } from "./components/Permissions/PermissionGuard";
import { useAuth } from "./context/AuthContext";
import { SidebarProvider } from "./context/SidebarContext";
import { ChatProvider } from "./context/ChatContext";
import { Permission } from "./utils/permissions";
import { ThemeProvider } from "./context/ThemeContext";
import { logout } from "./services/authService";
import ArtistLanding from "./pages/landing/ArtistLanding";
import FoundingArtistsPage from "./pages/landing/FoundingArtistsPage";
import BuyerLanding from "./pages/landing/BuyerLanding";
import { ScrollToTop } from "./components/Common/ScrollToTop";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";

/**
 * Single shell for all 5 bottom-nav tabs + artwork detail.
 * Each tab component is passed as a named prop so Layout keeps it mounted
 * in its own scroll container — switching tabs just toggles visibility,
 * scroll position is preserved natively.
 */
const PersistentFeedContainer: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { appUser } = useAuth();
  const handleLogout = async () => {
    await logout();
  };

  const postContent = useMemo(() => {
    if (!appUser) return null;
    if (appUser.role === 'artist') {
      if (!appUser.username) return null;
      return <Upload embedded />;
    }
    return <Commissions mode="form" />;
  }, [appUser]);

  const commissionsContent = useMemo(() => {
    if (!appUser) return null;
    return <Commissions mode="list" />;
  }, [appUser]);

  return (
    <Layout 
      onLogout={handleLogout}
      homeFeedComponent={<HomeFeed />}
      discoverComponent={<Discover />}
      favouritesComponent={<Favourites />}
      commissionsComponent={commissionsContent}
      postComponent={postContent}
    >
      {children ?? <Outlet />}
    </Layout>
  );
};

/** Username gate for feed tabs only (must be inside ProtectedRoute). */
const FeedTabGuard: React.FC = () => {
  const { appUser } = useAuth();
  if (appUser?.role === "artist" && !appUser?.username) {
    return <Navigate to="/create-username" replace />;
  }
  return null;
};

const FeedTabProtected: React.FC = () => (
  <ProtectedRoute>
    <FeedTabGuard />
  </ProtectedRoute>
);

// Main App Layout for static menu navigation
const MainAppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handleLogout = async () => {
    await logout();
  };

  return (
    <Layout 
      onLogout={handleLogout}
      homeFeedComponent={<HomeFeed />}
      discoverComponent={<Discover />}
      favouritesComponent={<Favourites />}
    >
      {children}
    </Layout>
  );
};

function App() {
  const { firebaseUser, appUser, loading } = useAuth();

  // Prevent pinch-zoom and gesture zoom across the app globally
  // The artwork preview handles its own zoom internally via React events
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      // Always prevent multi-touch zoom at browser level
      // The preview component handles its own zoom via React synthetic events
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventGestureZoom = (e: Event) => {
      // Always prevent Safari gesture zoom at browser level
      e.preventDefault();
    };

    // Prevent pinch-zoom on touchstart/touchmove
    document.addEventListener('touchstart', preventZoom, { passive: false });
    document.addEventListener('touchmove', preventZoom, { passive: false });
    
    // Prevent Safari gesture events
    document.addEventListener('gesturestart', preventGestureZoom);
    document.addEventListener('gesturechange', preventGestureZoom);
    document.addEventListener('gestureend', preventGestureZoom);

    // Prevent Ctrl/Cmd + scroll zoom on desktop
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    document.addEventListener('wheel', preventWheelZoom, { passive: false });

    return () => {
      document.removeEventListener('touchstart', preventZoom);
      document.removeEventListener('touchmove', preventZoom);
      document.removeEventListener('gesturestart', preventGestureZoom);
      document.removeEventListener('gesturechange', preventGestureZoom);
      document.removeEventListener('gestureend', preventGestureZoom);
      document.removeEventListener('wheel', preventWheelZoom);
    };
  }, []);

  // Helper function to check if user is authenticated
  const isAuthenticated = () => {
    return firebaseUser !== null && appUser !== null;
  };

  // Helper function to check if artist needs to create username
  const needsUsernameCreation = () => {
    return appUser?.role === "artist" && !appUser?.username;
  };

  const needsPasswordUpdate = () => {
    if (!appUser) return false;
    if (appUser.provider !== "password") return false;
    return !appUser.passwordPolicyVersion || appUser.passwordPolicyVersion < 2;
  };

  const handleLogin = () => {
    // Navigation handled by auth state change
  };

  const handleSignUp = () => {
    // Navigation handled by auth state change
  };

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    if (!loading) {
      document.body.style.background = '';
      const splash = document.getElementById('splash-screen');
      if (splash) {
        splash.classList.add('splash-hidden');
        setTimeout(() => splash.remove(), 500);
      }
    }
  }, [loading]);

  if (loading) {
    return null;
  }

  return (
    <>
      <div id="recaptcha-container"></div>
      <ThemeProvider>
        <Router>
          <ScrollToTop />
          <PwaUpdatePrompt />
          <SidebarProvider>
            <ChatProvider>
            <ToastContainer 
              position="top-center"
              autoClose={2000}
              hideProgressBar={false}
              newestOnTop={true}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
            <Routes>

              {/* Public routes */}
              <Route
                path="/"
                element={isAuthenticated() ? <Navigate to="/home" /> : <Home />}
              />

              <Route path="/about" element={<About />} />

              <Route path="/terms" element={<TermsOfService />} />

              <Route path="/privacy" element={<PrivacyPolicy />} />

              <Route path="/explore" element={<Explore />} />

              <Route path="/founding-artists" element={<FoundingArtistsPage />} />

              <Route
                path="/login"
                element={isAuthenticated() ? <Navigate to="/home" replace /> : <Login onLogin={handleLogin} />}
              />

              <Route
                path="/signup"
                element={isAuthenticated() ? <Navigate to={appUser!.role === "artist" ? "/artist" : appUser!.role === "buyer" ? "/buyer" : "/home"} replace /> : <SignUp onSignUp={handleSignUp} />}
              />

              {/* Username creation route for artists */}
              <Route
                path="/create-username"
                element={
                  <ProtectedRoute>
                    <PermissionGuard 
                      permission={Permission.CREATE_USERNAME}
                      redirectTo="/home"
                    >
                      {!appUser?.username ? (
                        <CreateUsername />
                      ) : (
                        <Navigate to="/home" replace />
                      )}
                    </PermissionGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/forgot-password"
                element={isAuthenticated() ? <Navigate to={appUser!.role === "artist" ? "/artist" : appUser!.role === "buyer" ? "/buyer" : "/dashboard"} /> : <ResetPassword />}
              />

              <Route
                path="/reset-password"
                element={isAuthenticated() ? <Navigate to="/home" replace /> : <SetNewPassword />}
              />

              <Route
                path="/update-password"
                element={
                  isAuthenticated() ? (
                    needsPasswordUpdate() ? <UpdatePassword /> : <Navigate to="/home" replace />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout onLogout={handleLogout} pageTitle="Dashboard">
                      <div style={{ padding: "2rem" }}>
                        <h1>Dashboard</h1>
                        <p>Welcome {appUser?.name}</p>
                      </div>
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <PermissionGuard 
                      permission={Permission.CREATE_ARTWORK}
                      redirectTo="/home"
                    >
                      {needsUsernameCreation() ? (
                        <Navigate to="/create-username" replace />
                      ) : (
                        <Upload />
                      )}
                    </PermissionGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/artist"
                element={
                  <ProtectedRoute>
                    <PermissionGuard 
                      permission={Permission.VIEW_ARTIST_PROFILE}
                      redirectTo="/home"
                    >
                      {needsUsernameCreation() ? (
                        <Navigate to="/create-username" replace />
                      ) : (
                        <ArtistLanding />
                      )}
                    </PermissionGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/buyer"
                element={
                  <ProtectedRoute>
                    <PermissionGuard 
                      permission={Permission.VIEW_BUYER_PROFILE}
                      redirectTo="/home"
                    >
                      <BuyerLanding />
                    </PermissionGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/my-artworks"
                element={
                  <ProtectedRoute>
                    <Layout onLogout={handleLogout} pageTitle="My Artworks">
                      <h1>🖼️ My Artworks</h1>
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    {needsUsernameCreation() ? (
                      <Navigate to="/create-username" replace />
                    ) : (
                      <MainAppLayout>
                        <Profile />
                      </MainAppLayout>
                    )}
                  </ProtectedRoute>
                }
              />

              {/*
                One persistent shell for feed tabs + artwork detail so /home|discover|favourites
                and /card/:id share the same Layout instance (scroll + data stay put).
              */}
              <Route element={<PersistentFeedContainer />}>
                <Route path="home" element={<FeedTabProtected />} />
                <Route path="discover" element={<FeedTabProtected />} />
                <Route path="favourites" element={<FeedTabProtected />} />
                <Route path="card/:id" element={<CardDetail />} />
                {/* Post and Commissions are mounted persistently via Layout props.
                   These route entries just ensure the URL matches and auth guards run. */}
                <Route path="post" element={<FeedTabProtected />} />
                <Route path="commissions" element={<FeedTabProtected />} />
              </Route>

              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <PermissionGuard
                      permission={Permission.VIEW_ARTIST_PROFILE}
                      redirectTo="/home"
                    >
                      {needsUsernameCreation() ? (
                        <Navigate to="/create-username" replace />
                      ) : (
                        <MainAppLayout>
                          <AccountHub />
                        </MainAppLayout>
                      )}
                    </PermissionGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/portfolio"
                element={
                  <ProtectedRoute>
                    <PermissionGuard 
                      permission={Permission.VIEW_PORTFOLIO}
                      redirectTo="/home"
                    >
                      {needsUsernameCreation() ? (
                        <Navigate to="/create-username" replace />
                      ) : (
                        <MainAppLayout>
                          <Portfolio />
                        </MainAppLayout>
                      )}
                    </PermissionGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/portfolio/:userId"
                element={
                <PersistentFeedContainer>
                  <OtherUserPortfolio />
                </PersistentFeedContainer>
                }
              />

              <Route
                path="/cart"
                element={
                  <ProtectedRoute>
                    <Layout onLogout={handleLogout} pageTitle="Shopping Cart">
                      <div style={{ padding: "2rem" }}>
                        <h1>🛒 Shopping Cart</h1>
                        <p>Your selected artworks</p>
                      </div>
                    </Layout>
                  </ProtectedRoute>
                }
              />

            </Routes>
            </ChatProvider>
          </SidebarProvider>
        </Router>
      </ThemeProvider>
    </>
  );
}

export default App;
