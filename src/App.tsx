import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './toastStyles.css';
import Layout from "./components/Layout/Layout";
import Home from "./pages/landing/Home";
import About from "./pages/landing/About";
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
import laptopDrawing from './animations/Laptop-Drawing 1.json';
import ArtistLanding from "./pages/landing/ArtistLanding";
import BuyerLanding from "./pages/landing/BuyerLanding";

// Persistent Feed Container Component
const PersistentFeedContainer: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
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

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <Lottie
          animationData={laptopDrawing}
          loop={true}
          style={{ width: '400px', height: '400px' }}
        />
        <p style={{
          marginTop: '1rem',
          fontSize: '1.2rem',
          color: '#008B8B',
          fontWeight: 500
        }}>
          Preparing your canvas...
        </p>
      </div>
    );
  }

  return (
    <>
      <div id="recaptcha-container"></div>
      <ThemeProvider>
        <Router>
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

              <Route path="/explore" element={<Explore />} />

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
                element={isAuthenticated() ? <Navigate to={appUser!.role === "artist" ? "/artist" : appUser!.role === "buyer" ? "/buyer" : "/dashboard"} /> : <SetNewPassword />}
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

              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    {needsUsernameCreation() ? (
                      <Navigate to="/create-username" replace />
                    ) : (
                      <PersistentFeedContainer />
                    )}
                  </ProtectedRoute>
                }
              />

              <Route
                path="/discover"
                element={
                  <ProtectedRoute>
                    {needsUsernameCreation() ? (
                      <Navigate to="/create-username" replace />
                    ) : (
                      <PersistentFeedContainer />
                    )}
                  </ProtectedRoute>
                }
              />

              <Route
                path="/post"
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
                path="/favourites"
                element={
                  <ProtectedRoute>
                    {needsUsernameCreation() ? (
                      <Navigate to="/create-username" replace />
                    ) : (
                      <PersistentFeedContainer />
                    )}
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
                  <ProtectedRoute>
                    {needsUsernameCreation() ? (
                      <Navigate to="/create-username" replace />
                    ) : (
                      <PersistentFeedContainer>
                        <OtherUserPortfolio />
                      </PersistentFeedContainer>
                    )}
                  </ProtectedRoute>
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

              <Route
                path="/card/:id"
                element={
                  <ProtectedRoute>
                    <PersistentFeedContainer>
                      <CardDetail />
                    </PersistentFeedContainer>
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
