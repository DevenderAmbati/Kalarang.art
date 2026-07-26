import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdHome, MdEmail, MdLock } from 'react-icons/md';
import { FaGoogle } from 'react-icons/fa';
import Lottie from 'lottie-react';
import { toast } from 'react-toastify';
import './login.css';
import { login } from "../../services/authService";
import { signInWithGoogle, signUpWithGoogle } from "../../services/authService";
import NewGoogleAccountModal from "../../components/Modals/NewGoogleAccountModal";
import {
  peekPendingGoogleNoAccount,
  clearPendingGoogleNoAccount,
  clearAuthFlow,
  clearAuthHold,
} from "../../utils/authFlow";

// Import all animations
import africanAmericanArt from '../../animations/African American Art.json';
import laptopDrawing from '../../animations/Laptop-Drawing 1.json';
import lineArt1 from '../../animations/Line art (1).json';
import lineArt2 from '../../animations/Line art (2).json';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [randomAnimation, setRandomAnimation] = useState<any>(null);
  const lottieRef = useRef<any>(null);

  // Restore confirmation modal if Sign In remounted during the auth race.
  useEffect(() => {
    const pending = peekPendingGoogleNoAccount();
    if (pending) {
      setNewAccountEmail(pending.email);
      setGoogleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!randomAnimation) return;
    const t = setTimeout(() => lottieRef.current?.setSpeed(2), 50);
    return () => clearTimeout(t);
  }, [randomAnimation]);

  const handleGoogleLogin = async (forceAccountPicker = false) => {
    try {
      setGoogleLoading(true);
      setErrorMessage('');
      clearPendingGoogleNoAccount();
      setNewAccountEmail(null);
      await signInWithGoogle({ forceAccountPicker });
      // Profile exists — AuthContext will route the user into the app.
    } catch (err: any) {
      setGoogleLoading(false);

      if (err.message === "NO_ACCOUNT" || err.message.includes("NO_ACCOUNT")) {
        // Prefer email from the error; fall back to sessionStorage (survives remounts).
        const pending = peekPendingGoogleNoAccount();
        setNewAccountEmail(err.email || pending?.email || '');
      } else if (err.message === "ACCOUNT_EXISTS_WITH_PASSWORD" || err.code === "auth/account-exists-with-different-credential") {
        clearAuthHold();
        clearAuthFlow();
        clearPendingGoogleNoAccount();
        toast.error("This account already exists. Please continue with email and password.", {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        setShowEmailForm(true);
      } else if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        clearAuthFlow();
        clearPendingGoogleNoAccount();
      } else {
        clearAuthFlow();
        clearPendingGoogleNoAccount();
        toast.error("Google login failed. Please try again.", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    }
  };

  // User confirmed they want to create a new account with this Google account.
  // Re-authenticate the same account (staying signed in) and continue onboarding.
  const handleContinueToSignUp = async () => {
    const pendingEmail = newAccountEmail || peekPendingGoogleNoAccount()?.email || undefined;
    clearPendingGoogleNoAccount();
    setNewAccountEmail(null);
    try {
      setGoogleLoading(true);
      setErrorMessage('');
      await signUpWithGoogle({ loginHint: pendingEmail });
      // signUpWithGoogle leaves authFlow=onboarding for new users.
      navigate('/select-role', { replace: true });
    } catch (err: any) {
      setGoogleLoading(false);
      clearAuthFlow();
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        return;
      }
      if (err.message === "ACCOUNT_EXISTS_WITH_PASSWORD") {
        clearAuthHold();
        toast.error("This account already exists. Please continue with email and password.", {
          position: "top-right",
          autoClose: 4000,
        });
        setShowEmailForm(true);
        return;
      }
      toast.error("Google sign up failed. Please try again.", {
        position: "top-right",
        autoClose: 3000,
      });
    }
  };

  const handleUseAnotherGoogleAccount = () => {
    clearPendingGoogleNoAccount();
    clearAuthFlow();
    setNewAccountEmail(null);
    handleGoogleLogin(true);
  };

  const handleCloseNoAccountModal = () => {
    clearPendingGoogleNoAccount();
    clearAuthFlow();
    setNewAccountEmail(null);
    setGoogleLoading(false);
  };

  const animations = [
    africanAmericanArt,
    laptopDrawing,
    lineArt1,
    lineArt2
  ];

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isFormValid = isValidEmail(email) && password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      try {
        const randomIndex = Math.floor(Math.random() * animations.length);
        setRandomAnimation(animations[randomIndex]);
        setIsLoading(true);
        setErrorMessage('');
        
        await login(email, password);
      } catch (error: any) {
        setIsLoading(false);
        setErrorMessage(" Oops! Those credentials don't match our records. Try again?");
      }
    }
  };

  if (isLoading && randomAnimation) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh', 
        width: '100%', 
        background: 'var(--color-bg-light)',
        gap: '2rem'
      }}>
        <div style={{ width: '400px', maxWidth: '90%' }}>
          <Lottie 
            animationData={randomAnimation} 
            loop={true} 
            autoplay={true}
            lottieRef={lottieRef}
          />
        </div>
        <div style={{ 
          textAlign: 'center', 
          maxWidth: '500px',
          padding: '0 1rem'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 700, 
            color: 'var(--color-primary)',
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Welcome back to your creative space
          </h2>
          <p style={{ 
            fontSize: '1rem', 
            color: 'var(--color-text-secondary)',
            lineHeight: '1.6'
          }}>
            Preparing your personalized art journey...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-right-section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', position: 'relative' }}>
      <div className="login-bg-shape-1"></div>
      <div className="login-bg-shape-2"></div>
      <div className="login-bg-shape-3"></div>
      <div className="login-bg-shape-4"></div>
      <div className="login-bg-shape-5"></div>
      <div className="login-bg-circle-1"></div>
      <div className="login-bg-circle-2"></div>
      <div className="login-bg-dot-pattern"></div>

      <NewGoogleAccountModal
        isOpen={newAccountEmail !== null}
        email={newAccountEmail || undefined}
        isLoading={googleLoading}
        onClose={handleCloseNoAccountModal}
        onContinue={handleContinueToSignUp}
        onUseAnotherAccount={handleUseAnotherGoogleAccount}
      />
      
      <div style={{ maxWidth: '500px', width: '100%', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button 
          className="login-home-button"
          onClick={() => navigate('/')}
          style={{
            position: 'absolute',
            top: '2rem',
            left: '2rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '500px',
            transition: 'all 0.3s ease',
            zIndex: 20
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--primary-alpha-10)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
        {MdHome({ size: 20 })}
        <span>Home</span>
      </button>
        
        <div className="login-mobile-header">
          <div className="login-brand-stack login-mobile-logo">
            <img src="/logobong.png" alt="BrushOwl Logo" className="login-brand-icon" />
            <div className="login-brand-text-stack">
              <img src="/text logo.png" alt="BrushOwl" className="login-brand-text" />
            </div>
          </div>
          <h1 className="login-mobile-headline">Get your paintings customized</h1>
          <p className="login-mobile-subtext">Discover and share original art with the world.</p>
        </div>

        <div className="login-form-container auth-card auth-card--signin">
          <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className="auth-mode-tab is-active"
            >
              <span className="auth-mode-tab-label">Sign In</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="false"
              className="auth-mode-tab"
              onClick={() => navigate('/signup')}
            >
              <span className="auth-mode-tab-hint">New to BrushOwl?</span>
              <span className="auth-mode-tab-label">Sign Up</span>
            </button>
          </div>

          <div className="login-header">
            <div className="login-welcome-back auth-eyebrow auth-eyebrow--signin">Continue your creative journey</div>
            <h2 className="login-title">Sign in to BrushOwl</h2>
            <p className="login-subtitle">Pick up where you left off with your art community</p>
          </div>

          <div className="login-auth-stack">
            <button
              type="button"
              className="login-google-primary"
              onClick={() => handleGoogleLogin()}
              disabled={googleLoading || isLoading}
            >
              {googleLoading ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="login-spin"
                >
                  <circle cx="12" cy="12" r="10" opacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                </svg>
              ) : (
                FaGoogle({ size: 18 })
              )}
              <span>{googleLoading ? 'Connecting…' : 'Sign in with Google'}</span>
            </button>

            <div className="login-divider-wrapper">
              <div className="login-divider-line"></div>
              <span className="login-divider-text">or</span>
              <div className="login-divider-line"></div>
            </div>

            {!showEmailForm ? (
              <button
                type="button"
                className="login-email-secondary"
                onClick={() => setShowEmailForm(true)}
              >
                {MdEmail({ size: 18 })}
                <span>Sign in with email</span>
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="login-form login-email-form">
                <div className="login-input-group">
                  <div className="login-input-wrapper">
                    {MdEmail({ className: "login-input-svg-icon", size: 20 })}
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="login-input"
                      required
                      autoFocus
                    />
                    <label className={`login-floating-label ${email ? 'login-floating-label-active' : ''}`}>
                      Email Address
                    </label>
                  </div>
                </div>

                <div className="login-input-group">
                  <div className="login-input-wrapper">
                    {MdLock({ className: "login-input-svg-icon", size: 20 })}
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="login-input"
                      required
                    />
                    <label className={`login-floating-label ${password ? 'login-floating-label-active' : ''}`}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="login-password-toggle"
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <div className="login-remember-forgot">
                  <label className="login-checkbox-label">
                    <input type="checkbox" className="login-checkbox" />
                    <span className="login-checkbox-text">Remember me</span>
                  </label>
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }} className="login-forgot-link">Forgot Password?</a>
                </div>

                {errorMessage && (
                  <div className="login-error-banner">
                    {errorMessage}
                  </div>
                )}

                <button type="submit" className="login-button primary-cta" disabled={!isFormValid || isLoading}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    Enter BrushOwl {isLoading ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="login-spin"
                      >
                        <circle cx="12" cy="12" r="10" opacity="0.25"/>
                        <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                      </svg>
                    ) : '→'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="login-corner-decor-1"></div>
        <div className="login-corner-decor-2"></div>
      </div>
    </div>
  );
};

export default Login;
