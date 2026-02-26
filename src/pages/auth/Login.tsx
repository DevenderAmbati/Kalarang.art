import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdHome, MdEmail, MdLock } from 'react-icons/md';
import { FaGoogle } from 'react-icons/fa';
import Lottie from 'lottie-react';
import { toast } from 'react-toastify';
import './login.css';
import { login } from "../../services/authService";
import { signInWithGoogle } from "../../services/authService";

// Import all animations
import africanAmericanArt from '../../animations/African American Art.json';
import girlBangsComputer from '../../animations/girl bangs computer.json';
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
  const [errorMessage, setErrorMessage] = useState('');
  const [randomAnimation, setRandomAnimation] = useState<any>(null);
  const [selectedAnimationIndex, setSelectedAnimationIndex] = useState<number>(-1);
  const lottieRef = useRef<any>(null);

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setErrorMessage('');
      const result = await signInWithGoogle();
      // Only if we reach here, login was successful
      // Navigation will be handled by AuthContext
    } catch (err: any) {
      console.error('Google login error:', err);
      
      // Handle different error cases
      if (err.message === "NO_ACCOUNT" || err.message.includes("NO_ACCOUNT")) {
        // Stop loading before navigating
        setGoogleLoading(false);
        toast.error("No account found. Please sign up first to join Kalarang!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        // Redirect to signup page after showing the message
        setTimeout(() => {
          navigate("/signup");
        }, 500);
      } else if (err.message === "ACCOUNT_EXISTS_WITH_PASSWORD" || err.code === "auth/account-exists-with-different-credential") {
        // Stop loading and stay on page
        setGoogleLoading(false);
        toast.error("This account already exists. Please continue with password.", {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        // Explicitly stay on login page - do nothing, just show the error
        return;
      } else {
        // Stop loading for other errors
        setGoogleLoading(false);
        toast.error("Google login failed. Please try again.", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    }
  };

  // Array of animations
  const animations = [
    africanAmericanArt,
    girlBangsComputer,
    laptopDrawing,
    lineArt1,
    lineArt2
  ];



  
  useEffect(() => {
    // Index 2 is laptopDrawing
    if (lottieRef.current && selectedAnimationIndex === 2) {
      setTimeout(() => {
        if (lottieRef.current) {
          lottieRef.current.setSpeed(0.5);
        }
      }, 100);
    }
  }, [selectedAnimationIndex]);

  // Email validation regex
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if form is valid
  const isFormValid = isValidEmail(email) && password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      try {
        // Select random animation and show loading
        const randomIndex = Math.floor(Math.random() * animations.length);
        setRandomAnimation(animations[randomIndex]);
        setSelectedAnimationIndex(randomIndex);
        setIsLoading(true);
        setErrorMessage('');
        
        await login(email, password);
        // Navigation will be handled by AuthContext automatically
        // Keep loading state to show animation until redirect happens
      } catch (error: any) {
        console.error('Login failed:', error);
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
            onComplete={() => {
              if (lottieRef.current && selectedAnimationIndex === 2) {
                lottieRef.current.setSpeed(0.5);
              }
            }}
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
      {/* Decorative geometric background shapes */}
      <div className="login-bg-shape-1"></div>
      <div className="login-bg-shape-2"></div>
      <div className="login-bg-shape-3"></div>
      <div className="login-bg-shape-4"></div>
      <div className="login-bg-shape-5"></div>
      <div className="login-bg-circle-1"></div>
      <div className="login-bg-circle-2"></div>
      <div className="login-bg-dot-pattern"></div>
      
      {/* Login Form Section */}
      <div style={{ maxWidth: '500px', width: '100%', zIndex: 10 }}>
        {/* Back to Home Button */}
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
        
        {/* Mobile Header - visible only on mobile */}
        <div className="login-mobile-header">
          <img
            src="/logo1.png"
            alt="Kalarang Logo"
            className="login-mobile-logo"
          />
          <h1 className="login-mobile-headline">Where Art Meets Its People</h1>
          <p className="login-mobile-subtext">Discover and share original art with the world.</p>
        </div>

        <div className="login-form-container">
          <div className="login-header">
            <div className="login-welcome-back">Welcome back</div>
            <h2 className="login-title">Continue your creative journey</h2>
            <p className="login-subtitle">Sign in to access your personalized Kalarang experience</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-input-group">
              <div className="login-input-wrapper">
                {MdEmail({ className: "login-input-svg-icon", size: 20 })}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input"
                  required
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
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '0.875rem',
                animation: 'slideIn 0.3s ease-out'
              }}>
                {errorMessage}
              </div>
            )}
            <style>{`
              @keyframes slideIn {
                from {
                  opacity: 0;
                  transform: translateY(-10px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}</style>

            <button type="submit" className="login-button primary-cta" disabled={!isFormValid || isLoading}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                Enter Kalarang {isLoading ? (
                  <svg 
                    width="18" 
                    height="18" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <circle cx="12" cy="12" r="10" opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                  </svg>
                ) : '→'}
              </span>
            </button>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>

            <div className="login-divider-wrapper">
              <div className="login-divider-line"></div>
              <span className="login-divider-text">or continue with</span>
              <div className="login-divider-line"></div>
            </div>

            <div className="login-social-buttons-group">
              <button type="button" className="login-social-button social-btn" onClick={handleGoogleLogin}>
                {FaGoogle({ size: 18 })}
                <span>Google</span>
              </button>
              {/* <button type="button" className="login-social-button social-btn">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="#1877F2">
                  <path d="M20 10c0-5.523-4.477-10-10-10S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z"/>
                </svg>
                <span>Facebook</span>
              </button> */}
            </div>
          </form>


          <div className="login-footer">
            <p className="login-footer-text">
              Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signup'); }} className="login-signup-link">Sign up for free</a>
            </p>
          </div>
        </div>

        {/* Decorative corner elements */}
        <div className="login-corner-decor-1"></div>
        <div className="login-corner-decor-2"></div>
      </div>
    </div>
  );
};

export default Login;