import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdLock, MdCheckCircle, MdCancel } from 'react-icons/md';
import { toast } from 'react-toastify';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import './login.css';
import './reset-password.css';

const CURRENT_PASSWORD_POLICY_VERSION = 2;

const UpdatePassword: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser, appUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [validations, setValidations] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    passwordsMatch: false,
  });

  useEffect(() => {
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const passwordsMatch =
      password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

    setValidations({ minLength, hasUppercase, hasLowercase, hasNumber, hasSpecialChar, passwordsMatch });
  }, [password, confirmPassword]);

  const isFormValid =
    currentPassword.length > 0 &&
    validations.minLength &&
    validations.hasUppercase &&
    validations.hasLowercase &&
    validations.hasNumber &&
    validations.hasSpecialChar &&
    validations.passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !firebaseUser || !firebaseUser.email) return;

    setIsLoading(true);

    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, password);

      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        passwordPolicyVersion: CURRENT_PASSWORD_POLICY_VERSION,
      });

      toast.success('Password updated successfully!', {
        position: 'top-right',
        autoClose: 3000,
      });

      navigate('/home', { replace: true });
    } catch (error: any) {
      console.error('Password update error:', error);

      let errorMessage = 'Failed to update password. Please try again.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Current password is incorrect.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="login-right-section"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
      }}
    >
      <div className="login-bg-shape-1"></div>
      <div className="login-bg-shape-2"></div>
      <div className="login-bg-shape-3"></div>
      <div className="login-bg-shape-4"></div>
      <div className="login-bg-shape-5"></div>
      <div className="login-bg-circle-1"></div>
      <div className="login-bg-circle-2"></div>
      <div className="login-bg-dot-pattern"></div>

      <div style={{ maxWidth: '550px', width: '100%', zIndex: 10 }}>
        <div className="login-mobile-header">
          <img src="/logo1.png" alt="Kalarang Logo" className="login-mobile-logo" />
          <h1 className="login-mobile-headline">Where Art Meets Its People</h1>
          <p className="login-mobile-subtext">Update your password to meet our security requirements.</p>
        </div>

        <div className="login-form-container">
          <div className="login-header">
            <div className="login-welcome-back">Password Update Required</div>
            <h2 className="login-title">Set a new password</h2>
            <p className="login-subtitle">
              Our password policy has been updated. Please set a new password that meets the
              requirements below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {/* Current password */}
            <div className="login-input-group">
              <div className="login-input-wrapper">
                {MdLock({ className: 'login-input-svg-icon', size: 20 })}
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="login-input"
                  required
                />
                <label
                  className={`login-floating-label ${currentPassword ? 'login-floating-label-active' : ''}`}
                >
                  Current Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="login-password-toggle"
                >
                  {showCurrentPassword ? '\u{1F441}\uFE0F' : '\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F'}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="login-input-group">
              <div className="login-input-wrapper">
                {MdLock({ className: 'login-input-svg-icon', size: 20 })}
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                  required
                />
                <label
                  className={`login-floating-label ${password ? 'login-floating-label-active' : ''}`}
                >
                  New Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle"
                >
                  {showPassword ? '\u{1F441}\uFE0F' : '\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F'}
                </button>
              </div>
            </div>

            {/* Confirm new password */}
            <div className="login-input-group">
              <div className="login-input-wrapper">
                {MdLock({ className: 'login-input-svg-icon', size: 20 })}
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="login-input"
                  required
                />
                <label
                  className={`login-floating-label ${confirmPassword ? 'login-floating-label-active' : ''}`}
                >
                  Confirm New Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="login-password-toggle"
                >
                  {showConfirmPassword ? '\u{1F441}\uFE0F' : '\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F'}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="password-requirements">
              <div className="requirements-title">Password must contain:</div>
              <div className="requirements-list">
                <div className={`requirement-item ${validations.minLength ? 'valid' : ''}`}>
                  {validations.minLength
                    ? MdCheckCircle({ className: 'requirement-icon valid' })
                    : MdCancel({ className: 'requirement-icon invalid' })}
                  <span>At least 8 characters</span>
                </div>
                <div className={`requirement-item ${validations.hasUppercase ? 'valid' : ''}`}>
                  {validations.hasUppercase
                    ? MdCheckCircle({ className: 'requirement-icon valid' })
                    : MdCancel({ className: 'requirement-icon invalid' })}
                  <span>One uppercase letter (A-Z)</span>
                </div>
                <div className={`requirement-item ${validations.hasLowercase ? 'valid' : ''}`}>
                  {validations.hasLowercase
                    ? MdCheckCircle({ className: 'requirement-icon valid' })
                    : MdCancel({ className: 'requirement-icon invalid' })}
                  <span>One lowercase letter (a-z)</span>
                </div>
                <div className={`requirement-item ${validations.hasNumber ? 'valid' : ''}`}>
                  {validations.hasNumber
                    ? MdCheckCircle({ className: 'requirement-icon valid' })
                    : MdCancel({ className: 'requirement-icon invalid' })}
                  <span>One number (0-9)</span>
                </div>
                <div className={`requirement-item ${validations.hasSpecialChar ? 'valid' : ''}`}>
                  {validations.hasSpecialChar
                    ? MdCheckCircle({ className: 'requirement-icon valid' })
                    : MdCancel({ className: 'requirement-icon invalid' })}
                  <span>One special character (!@#$%...)</span>
                </div>
                {confirmPassword && (
                  <div className={`requirement-item ${validations.passwordsMatch ? 'valid' : ''}`}>
                    {validations.passwordsMatch
                      ? MdCheckCircle({ className: 'requirement-icon valid' })
                      : MdCancel({ className: 'requirement-icon invalid' })}
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
              <span
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
              >
                {isLoading ? 'Updating Password...' : 'Update Password'}
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
                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                  </svg>
                ) : (
                  '\u2192'
                )}
              </span>
            </button>
          </form>
        </div>

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

export default UpdatePassword;
