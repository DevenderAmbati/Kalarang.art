import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdHome, MdEmail, MdLock, MdPerson, MdCheckCircle, MdCancel } from 'react-icons/md';
import { FaGoogle } from 'react-icons/fa';
import Lottie from 'lottie-react';
import { toast } from 'react-toastify';
import './login.css';
import './reset-password.css';
import { signup, signInWithGoogle } from "../../services/authService";

// Import all animations
import africanAmericanArt from '../../animations/African American Art.json';
import girlBangsComputer from '../../animations/girl bangs computer.json';
import laptopDrawing from '../../animations/Laptop-Drawing 1.json';
import lineArt1 from '../../animations/Line art (1).json';
import lineArt2 from '../../animations/Line art (2).json';


interface SignUpProps {
  onSignUp: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onSignUp }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [userType, setUserType] = useState<'artist' | 'buyer' | ''>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');  const [isLoading, setIsLoading] = useState(false);
  const [randomAnimation, setRandomAnimation] = useState<any>(null);
  const [selectedAnimationIndex, setSelectedAnimationIndex] = useState<number>(-1);
  const lottieRef = useRef<any>(null);

  // Password validation states
  const [validations, setValidations] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    passwordsMatch: false,
  });

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

  useEffect(() => {
    // Validate password in real-time
    const minLength = formData.password.length >= 8;
    const hasUppercase = /[A-Z]/.test(formData.password);
    const hasLowercase = /[a-z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password);
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

  // Email validation regex
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if form is valid
  const isFormValid = 
    formData.fullName.trim().length >= 2 &&
    isValidEmail(formData.email) && 
    validations.minLength &&
    validations.hasUppercase &&
    validations.hasLowercase &&
    validations.hasNumber &&
    validations.hasSpecialChar &&
    validations.passwordsMatch &&
    userType !== '' &&
    agreedToTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      try {
        // Show loader before signup
        const randomIndex = Math.floor(Math.random() * animations.length);
        setRandomAnimation(animations[randomIndex]);
        setSelectedAnimationIndex(randomIndex);
        setIsLoading(true);
        
        // All validations passed, now signup
        await signup(formData.fullName, formData.email, formData.password, userType);
        
        onSignUp();
      } catch (error: any) {
        console.error('Sign up failed:', error);
        setIsLoading(false);
        setRandomAnimation(null);
        
        // Check if email already exists
        if (error.code === 'auth/email-already-in-use') {
          toast.error('This email is already registered.', {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          
        } else {
          toast.error('Signup failed. Please try again.', {
            position: "top-right",
            autoClose: 3000,
          });
        }
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGoogleSignup = async () => {
    try {
      if (!userType) {
        setError("Please select a role first (artist or buyer)");
        return;
      }
      
      // Show loader before Google sign-in
      const randomIndex = Math.floor(Math.random() * animations.length);
      setRandomAnimation(animations[randomIndex]);
      setSelectedAnimationIndex(randomIndex);
      setIsLoading(true);
      
      // All validations passed, proceed with Google sign-in
      await signInWithGoogle(userType); // role = artist | buyer
    } catch (err: any) {
      setIsLoading(false);
      setRandomAnimation(null);
      
      if (err.message === "ROLE_REQUIRED") {
        setError("Please select a role first (artist or buyer)");
      } else if (err.message === "ACCOUNT_EXISTS" || err.message.includes("ACCOUNT_EXISTS")) {
        toast.error("The account already exists. Try login!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        // Redirect immediately to login page
        navigate('/login');
      } else if (err.code === 'auth/account-exists-with-different-credential' || err.code === 'auth/email-already-in-use') {
        toast.error("This account already exists. Please login instead!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        // Redirect immediately to login page
        navigate('/login');
      } else {
        toast.error("Google signup failed. Please try again.", {
          position: "top-right",
          autoClose: 3000,
        });
        setError("Google signup failed");
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
            Your artistic adventure begins now
          </h2>
          <p style={{ 
            fontSize: '1rem', 
            color: 'var(--color-text-secondary)',
            lineHeight: '1.6'
          }}>
            Creating your creative sanctuary on Kalarang...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-right-section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', position: 'relative', padding: '3rem 0' }}>
      {/* Decorative geometric background shapes */}
      <div className="login-bg-shape-1"></div>
      <div className="login-bg-shape-2"></div>
      <div className="login-bg-shape-3"></div>
      <div className="login-bg-shape-4"></div>
      <div className="login-bg-shape-5"></div>
      <div className="login-bg-circle-1"></div>
      <div className="login-bg-circle-2"></div>
      <div className="login-bg-dot-pattern"></div>
      
      {/* Sign Up Form Section */}
      <div style={{ maxWidth: '500px', width: '100%', zIndex: 10, margin: '2rem 0' }}>
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

        <div className="login-form-container" style={{ padding: '1rem' }}>
          <div className="login-header" style={{ marginBottom: '0.5rem' }}>
            <div className="login-welcome-back" style={{ fontSize: '0.7rem', marginBottom: '0.15rem' }}>Join the Community</div>
            <h2 className="login-title" style={{ fontSize: '1.1rem', marginBottom: '0' }}>Create your Kalarang account</h2>
          </div>

          <form onSubmit={handleSubmit} className="login-form" style={{ gap: '0.8rem' }}>
            <div className="login-input-group" style={{ marginBottom: '0.25rem' }}>
              <label style={{ 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: 'var(--color-primary)', 
                marginBottom: '0.35rem',
                display: 'block',
                textAlign: 'center'
              }}>
                I am joining as
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '0.75rem',
                marginBottom: '0'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setUserType('artist');
                    setError('');
                  }}
                  style={{
                    padding: '0.5rem',
                    border: userType === 'artist' ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                    borderRadius: '10px',
                    background: userType === 'artist' ? 'var(--primary-alpha-10)' : 'var(--color-bg-white)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                  onMouseEnter={(e) => {
                    if (userType !== 'artist') {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.background = 'var(--primary-alpha-5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (userType !== 'artist') {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.background = 'var(--color-bg-white)';
                    }
                  }}
                >
                  <span style={{ 
                    fontWeight: 600, 
                    color: 'var(--color-primary)',
                    fontSize: '0.75rem'
                  }}>
                    Artist
                  </span>
                  <span style={{ 
                    fontSize: '0.65rem', 
                    color: 'var(--color-text-secondary)',
                    textAlign: 'center'
                  }}>
                    Showcase & sell art
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserType('buyer');
                    setError('');
                  }}
                  style={{
                    padding: '0.5rem',
                    border: userType === 'buyer' ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                    borderRadius: '10px',
                    background: userType === 'buyer' ? 'var(--primary-alpha-10)' : 'var(--color-bg-white)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                  onMouseEnter={(e) => {
                    if (userType !== 'buyer') {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.background = 'var(--primary-alpha-5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (userType !== 'buyer') {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.background = 'var(--color-bg-white)';
                    }
                  }}
                >
                  <span style={{ 
                    fontWeight: 600, 
                    color: 'var(--color-primary)',
                    fontSize: '0.8rem'
                  }}>
                    Buyer
                  </span>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--color-text-secondary)',
                    textAlign: 'center'
                  }}>
                    Discover & collect art
                  </span>
                </button>
              </div>
            </div>

            <div className="login-input-group" style={{ marginBottom: '0.35rem', marginTop: '0.25rem' }}>
              <div className="login-input-wrapper">
                {MdPerson({ className: "login-input-svg-icon", size: 18 })}
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="login-input"
                  required
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

            <div className="login-input-group" style={{ marginBottom: '0rem' }}>
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

            {/* Password Requirements */}
            {formData.password && (
              <div className="password-requirements" style={{ marginBottom: '1rem' }}>
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

            <div className="login-remember-forgot" style={{ marginBottom: '0rem', marginTop: '0.25rem' }}>
              <label className="login-checkbox-label">
                <input 
                  type="checkbox" 
                  className="login-checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <span className="login-checkbox-text">
                  I agree to the <a href="#" style={{ color: 'var(--color-primary)' }}>Terms of Service</a> and <a href="#" style={{ color: 'var(--color-primary)' }}>Privacy Policy</a>
                </span>
              </label>
            </div>

            <button type="submit" className="login-button primary-cta" disabled={!isFormValid || isLoading} style={{ marginBottom: '0rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                Create Account {isLoading ? (
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

            <div className="login-divider-wrapper" style={{ margin: '0.2rem 0' }}>
              <div className="login-divider-line"></div>
              <span className="login-divider-text">or sign up with</span>
              <div className="login-divider-line"></div>
            </div>

            <div className="login-social-buttons-group" style={{ marginBottom: '0.4rem' }}>
              <button type="button" className="login-social-button social-btn" onClick={handleGoogleSignup}>
                {FaGoogle({ size: 18 })}
                <span>Google</span>
              </button>
            </div>
            {error && (
              <div style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '0.875rem'
              }}>
                {error}
              </div>
            )}
          </form>

          <div className="login-footer" style={{ marginTop: '0.35rem' }}>
            <p className="login-footer-text">
              Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }} className="login-signup-link">Sign in</a>
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

export default SignUp;
