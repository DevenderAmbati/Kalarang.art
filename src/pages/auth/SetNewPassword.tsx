import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MdHome, MdLock, MdCheckCircle, MdCancel } from 'react-icons/md';
import { toast } from 'react-toastify';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import './login.css';
import './reset-password.css';

const SetNewPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [isValidCode, setIsValidCode] = useState(false);

  // Password validation states
  const [validations, setValidations] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    passwordsMatch: false,
  });

  useEffect(() => {
    const code = searchParams.get('oobCode');
    if (!code) {
      toast.error('Invalid reset link. Please request a new one.');
      navigate('/forgot-password');
      return;
    }

    // Verify the reset code
    verifyPasswordResetCode(auth, code)
      .then((email) => {
        setOobCode(code);
        setEmail(email);
        setIsValidCode(true);
        setIsVerifying(false);
      })
      .catch((error) => {
        console.error('Error verifying reset code:', error);
        toast.error('This reset link is invalid or has expired. Please request a new one.');
        setTimeout(() => {
          navigate('/forgot-password');
        }, 2000);
      });
  }, [searchParams, navigate]);

  useEffect(() => {
    // Validate password in real-time
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

    setValidations({
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      passwordsMatch,
    });
  }, [password, confirmPassword]);

  const isFormValid = 
    validations.minLength &&
    validations.hasUppercase &&
    validations.hasLowercase &&
    validations.hasNumber &&
    validations.hasSpecialChar &&
    validations.passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid || !oobCode) {
      return;
    }

    setIsLoading(true);

    try {
      // Reset the password
      await confirmPasswordReset(auth, oobCode, password);
      
      // Find user by email to update Firestore (without signing in)
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'users', userDoc.id), {
          passwordPolicyVersion: 2,
        });
      }
      
      toast.success('Password reset successful! You can now login with your new password.', {
        position: 'top-right',
        autoClose: 4000,
      });
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error: any) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to reset password. Please try again.';
      
      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'This reset link has expired. Please request a new one.';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'This reset link is invalid. Please request a new one.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      }
      
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh', 
        background: 'var(--color-bg-light)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <svg 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="var(--color-primary)" 
            strokeWidth="2"
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }}
          >
            <circle cx="12" cy="12" r="10" opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
          </svg>
          <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>
            Verifying reset link...
          </p>
        </div>
      </div>
    );
  }

  if (!isValidCode) {
    return null;
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
      
      {/* Reset Password Form Section */}
      <div style={{ maxWidth: '550px', width: '100%', zIndex: 10 }}>
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
          <p className="login-mobile-subtext">Secure your account with a new password.</p>
        </div>

        <div className="login-form-container">
          <div className="login-header">
            <div className="login-welcome-back">Reset Password</div>
            <h2 className="login-title">Create a new password</h2>
            <p className="login-subtitle">
              {email && <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{email}</span>}
              {email && <br />}
              Choose a strong password to secure your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
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
                  New Password
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

            <div className="login-input-group">
              <div className="login-input-wrapper">
                {MdLock({ className: "login-input-svg-icon", size: 20 })}
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="login-input"
                  required
                />
                <label className={`login-floating-label ${confirmPassword ? 'login-floating-label-active' : ''}`}>
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
            <div className="password-requirements">
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
                {confirmPassword && (
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

            <button 
              type="submit" 
              className="login-button primary-cta" 
              disabled={!isFormValid || isLoading}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
                {isLoading ? (
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
          </form>

          <div className="login-footer">
            <p className="login-footer-text">
              Remember your password? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }} className="login-signup-link">Back to login</a>
            </p>
          </div>
        </div>

        {/* Decorative corner elements */}
        <div className="login-corner-decor-1"></div>
        <div className="login-corner-decor-2"></div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SetNewPassword;
