import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdHome, MdEmail, MdLock, MdPerson, MdCheckCircle, MdCancel } from 'react-icons/md';
import { FaGoogle } from 'react-icons/fa';
import Lottie from 'lottie-react';
import { toast } from 'react-toastify';
import './login.css';
import './reset-password.css';
import { registerWithEmail, signUpWithGoogle } from "../../services/authService";
import { setAuthFlow, clearAuthHold } from "../../utils/authFlow";

// Import all animations
import africanAmericanArt from '../../animations/African American Art.json';
import laptopDrawing from '../../animations/Laptop-Drawing 1.json';
import lineArt1 from '../../animations/Line art (1).json';
import lineArt2 from '../../animations/Line art (2).json';


interface SignUpProps {
  onSignUp: () => void;
}

const SignUp: React.FC<SignUpProps> = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [randomAnimation, setRandomAnimation] = useState<any>(null);
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    if (!randomAnimation) return;
    const t = setTimeout(() => lottieRef.current?.setSpeed(2), 50);
    return () => clearTimeout(t);
  }, [randomAnimation]);

  const [validations, setValidations] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    passwordsMatch: false,
  });

  const animations = [
    africanAmericanArt,
    laptopDrawing,
    lineArt1,
    lineArt2
  ];

  useEffect(() => {
    const minLength = formData.password.length >= 8;
    const hasUppercase = /[A-Z]/.test(formData.password);
    const hasLowercase = /[a-z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password);
    const passwordsMatch = formData.password.length > 0 && formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword;

    setValidations({
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      passwordsMatch,
    });
  }, [formData.password, formData.confirmPassword]);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isEmailFormReady =
    formData.fullName.trim().length >= 2 &&
    isValidEmail(formData.email) &&
    validations.minLength &&
    validations.hasUppercase &&
    validations.hasLowercase &&
    validations.hasNumber &&
    validations.hasSpecialChar &&
    validations.passwordsMatch &&
    agreedToTerms;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const startLoaderAnimation = () => {
    const randomIndex = Math.floor(Math.random() * animations.length);
    setRandomAnimation(animations[randomIndex]);
    setIsLoading(true);
  };

  const handleGoogleSignup = async () => {
    if (googleLoading || isLoading) return;
    try {
      setGoogleLoading(true);
      setError('');
      startLoaderAnimation();

      const { profileExists } = await signUpWithGoogle({ forceAccountPicker: true });

      toast.dismiss();
      if (profileExists) {
        // Returning user — AuthContext will route them straight into the app.
        return;
      }
      // New account — continue onboarding with role selection.
      navigate('/select-role', { replace: true });
    } catch (err: any) {
      setIsLoading(false);
      setGoogleLoading(false);
      setRandomAnimation(null);

      if (err.message === "ACCOUNT_EXISTS_WITH_PASSWORD" || err.code === "auth/account-exists-with-different-credential") {
        clearAuthHold();
        toast.error("This email already has an account. Please sign in with your password.", {
          position: "top-right",
          autoClose: 4000,
        });
        navigate('/login');
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User dismissed the Google chooser — nothing to report.
      } else {
        clearAuthHold();
        toast.error("Google sign up failed. Please try again.", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailFormReady || isLoading) return;
    try {
      setError('');
      startLoaderAnimation();

      await registerWithEmail(formData.fullName.trim(), formData.email, formData.password);

      toast.dismiss();
      // Authenticated but no profile yet — continue onboarding with role selection.
      setAuthFlow('onboarding');
      navigate('/select-role', { replace: true });
    } catch (error: unknown) {
      setIsLoading(false);
      setRandomAnimation(null);
      const err = error as { code?: string };
      if (err.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Please sign in instead.', {
          position: "top-right",
          autoClose: 3000,
        });
      } else {
        toast.error('Sign up failed. Please try again.', {
          position: "top-right",
          autoClose: 3000,
        });
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
            Your artistic adventure begins now
          </h2>
          <p style={{ 
            fontSize: '1rem', 
            color: 'var(--color-text-secondary)',
            lineHeight: '1.6'
          }}>
            Setting up your BrushOwl account...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-right-section signup-page" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', minHeight: '100vh', width: '100%', position: 'relative', padding: '3rem 0' }}>
      <div className="login-bg-shape-1"></div>
      <div className="login-bg-shape-2"></div>
      <div className="login-bg-shape-3"></div>
      <div className="login-bg-shape-4"></div>
      <div className="login-bg-shape-5"></div>
      <div className="login-bg-circle-1"></div>
      <div className="login-bg-circle-2"></div>
      <div className="login-bg-dot-pattern"></div>
      
      <div style={{ maxWidth: '500px', width: '100%', zIndex: 10, margin: 'auto 0', padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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

        <div className="login-form-container auth-card auth-card--signup">
          <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected="false"
              className="auth-mode-tab"
              onClick={() => navigate('/login')}
            >
              <span className="auth-mode-tab-hint">Already have an account?</span>
              <span className="auth-mode-tab-label">Sign In</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className="auth-mode-tab is-active"
            >
              <span className="auth-mode-tab-label">Sign Up</span>
            </button>
          </div>

          <div className="login-header">
            <div className="login-welcome-back auth-eyebrow auth-eyebrow--signup">Start your creative journey</div>
            <h2 className="login-title">Create your BrushOwl account</h2>
            <p className="login-subtitle">Join artists and collectors — it only takes a minute</p>
          </div>

          <div className="login-auth-stack">
            <button
              type="button"
              className="login-google-primary"
              onClick={handleGoogleSignup}
              disabled={googleLoading || isLoading}
            >
              {googleLoading ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-spin">
                  <circle cx="12" cy="12" r="10" opacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                </svg>
              ) : FaGoogle({ size: 18 })}
              <span>{googleLoading ? 'Connecting…' : 'Sign up with Google'}</span>
            </button>

            <div className="login-divider-wrapper">
              <div className="login-divider-line"></div>
              <span className="login-divider-text">or</span>
              <div className="login-divider-line"></div>
            </div>

            {!showEmailForm ? (
              <>
                <button
                  type="button"
                  className="login-email-secondary"
                  onClick={() => { setShowEmailForm(true); setError(''); }}
                >
                  {MdEmail({ size: 18 })}
                  <span>Sign up with email</span>
                </button>

                <p className="login-google-hint">
                  By continuing, you agree to our{' '}
                  <a onClick={() => navigate('/terms')} style={{ color: 'var(--color-primary)', cursor: 'pointer' }}>Terms</a>
                  {' '}and{' '}
                  <a onClick={() => navigate('/privacy')} style={{ color: 'var(--color-primary)', cursor: 'pointer' }}>Privacy Policy</a>
                </p>
              </>
            ) : (
              <form onSubmit={handleEmailSubmit} className="login-form login-email-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div className="login-input-group" style={{ marginBottom: '0.35rem' }}>
                  <div className="login-input-wrapper">
                    {MdPerson({ className: "login-input-svg-icon", size: 18 })}
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="login-input"
                      required
                      autoFocus
                    />
                    <label className={`login-floating-label ${formData.fullName ? 'login-floating-label-active' : ''}`}>
                      Full Name
                    </label>
                  </div>
                </div>

                <div className="login-input-group" style={{ marginBottom: '0.35rem' }}>
                  <div className="login-input-wrapper">
                    {MdEmail({ className: "login-input-svg-icon", size: 18 })}
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="login-input"
                      required
                    />
                    <label className={`login-floating-label ${formData.email ? 'login-floating-label-active' : ''}`}>
                      Email Address
                    </label>
                  </div>
                </div>

                <div className="login-input-group" style={{ marginBottom: '0.35rem' }}>
                  <div className="login-input-wrapper">
                    {MdLock({ className: "login-input-svg-icon", size: 18 })}
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="login-input"
                      required
                    />
                    <label className={`login-floating-label ${formData.password ? 'login-floating-label-active' : ''}`}>
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

                <div className="login-input-group" style={{ marginBottom: 0 }}>
                  <div className="login-input-wrapper">
                    {MdLock({ className: "login-input-svg-icon", size: 18 })}
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="login-input"
                      required
                    />
                    <label className={`login-floating-label ${formData.confirmPassword ? 'login-floating-label-active' : ''}`}>
                      Confirm Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="login-password-toggle"
                    >
                      {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                {formData.password && (
                  <div className="password-requirements" style={{ marginBottom: '0.5rem' }}>
                    <div className="requirements-title">Password must contain:</div>
                    <div className="requirements-list">
                      <div className={`requirement-item ${validations.minLength ? 'valid' : ''}`}>
                        {validations.minLength ? (
                          MdCheckCircle({ className: "requirement-icon valid" })
                        ) : (
                          MdCancel({ className: "requirement-icon invalid" })
                        )}
                        <span>At least 8 characters</span>
                      </div>
                      <div className={`requirement-item ${validations.hasUppercase ? 'valid' : ''}`}>
                        {validations.hasUppercase ? (
                          MdCheckCircle({ className: "requirement-icon valid" })
                        ) : (
                          MdCancel({ className: "requirement-icon invalid" })
                        )}
                        <span>One uppercase letter (A-Z)</span>
                      </div>
                      <div className={`requirement-item ${validations.hasLowercase ? 'valid' : ''}`}>
                        {validations.hasLowercase ? (
                          MdCheckCircle({ className: "requirement-icon valid" })
                        ) : (
                          MdCancel({ className: "requirement-icon invalid" })
                        )}
                        <span>One lowercase letter (a-z)</span>
                      </div>
                      <div className={`requirement-item ${validations.hasNumber ? 'valid' : ''}`}>
                        {validations.hasNumber ? (
                          MdCheckCircle({ className: "requirement-icon valid" })
                        ) : (
                          MdCancel({ className: "requirement-icon invalid" })
                        )}
                        <span>One number (0-9)</span>
                      </div>
                      <div className={`requirement-item ${validations.hasSpecialChar ? 'valid' : ''}`}>
                        {validations.hasSpecialChar ? (
                          MdCheckCircle({ className: "requirement-icon valid" })
                        ) : (
                          MdCancel({ className: "requirement-icon invalid" })
                        )}
                        <span>One special character (!@#$%...)</span>
                      </div>
                      {formData.confirmPassword && (
                        <div className={`requirement-item ${validations.passwordsMatch ? 'valid' : ''}`}>
                          {validations.passwordsMatch ? (
                            MdCheckCircle({ className: "requirement-icon valid" })
                          ) : (
                            MdCancel({ className: "requirement-icon invalid" })
                          )}
                          <span>Passwords match</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="login-remember-forgot" style={{ marginBottom: 0, marginTop: '0.25rem' }}>
                  <label className="login-checkbox-label">
                    <input
                      type="checkbox"
                      className="login-checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                    />
                    <span className="login-checkbox-text">
                      I agree to the <a onClick={() => navigate('/terms')} style={{ color: 'var(--color-primary)', cursor: 'pointer' }}>Terms of Service</a> and <a onClick={() => navigate('/privacy')} style={{ color: 'var(--color-primary)', cursor: 'pointer' }}>Privacy Policy</a>
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="login-error-banner">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="login-button primary-cta"
                  disabled={!isEmailFormReady || isLoading}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    Continue →
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

export default SignUp;
