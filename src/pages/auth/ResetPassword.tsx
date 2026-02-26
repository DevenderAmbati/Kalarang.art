import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdHome, MdEmail } from 'react-icons/md';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import './login.css';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Email validation regex
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if form is valid
  const isFormValid = isValidEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    try {
      // Use environment-based config
      const baseUrl =
        window.location.hostname.includes("staging")
          ? "https://kalarang-staging.web.app"
          : "https://kalarang.art";

      await sendPasswordResetEmail(auth, email, {
        url: `${baseUrl}/reset-password`,
        handleCodeInApp: true
      });
      
      setIsSubmitted(true);
      setSuccessMessage(' If an account exists, a password reset link has been sent to your email!');
    } catch (error: any) {
      console.error('Password reset failed:', error);
      setErrorMessage(' Oops! Something went wrong. Please try again.');
    }
  };

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
            <p className="login-mobile-subtext">Recover your account and get back to creating.</p>
          </div>

          <div className="login-form-container">
            <div className="login-header">
              <div className="login-welcome-back">Account Recovery</div>
              <h2 className="login-title">Reset your password</h2>
              <p className="login-subtitle">Enter your email and we'll send you instructions to reset your password</p>
            </div>

          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-input-group">
                <div className="login-input-wrapper">
                  {MdEmail({ className: "login-input-svg-icon", size: 20 })}
                  <input
                    id="email"
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

              <button type="submit" className="login-button primary-cta" disabled={!isFormValid}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  Send Reset Link →
                </span>
              </button>


              <div className="login-footer">
                <p className="login-footer-text">
                  Remember your password? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }} className="login-signup-link">Back to Login</a>
                </p>
              </div>
            </form>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'var(--primary-alpha-10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'scaleIn 0.5s ease-out'
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                marginBottom: '0.75rem'
              }}>
                Check Your Email
              </h3>
              <p style={{
                fontSize: '1rem',
                color: 'var(--color-text-secondary)',
                marginBottom: '0.5rem',
                lineHeight: '1.6'
              }}>
                {successMessage}
              </p>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-tertiary)',
                marginBottom: '2rem',
                lineHeight: '1.5'
              }}>
                If you don't see the email, check your spam folder or try again.
              </p>
              <button 
                onClick={() => navigate('/login')}
                className="login-button primary-cta"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  Return to Login →
                </span>
              </button>
              <style>{`
                @keyframes scaleIn {
                  from {
                    transform: scale(0);
                    opacity: 0;
                  }
                  to {
                    transform: scale(1);
                    opacity: 1;
                  }
                }
              `}</style>
            </div>
          )}
          </div>
          
          {/* Decorative corner elements */}
          <div className="login-corner-decor-1"></div>
          <div className="login-corner-decor-2"></div>
        </div>
      </div>
    
  );
};

export default ResetPassword;
