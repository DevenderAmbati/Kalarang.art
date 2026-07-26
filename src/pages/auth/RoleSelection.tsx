import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MdBrush, MdShoppingBag } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { createUserProfile } from '../../services/authService';
import { clearAuthFlow } from '../../utils/authFlow';
import { UserRole } from '../../types/user';
import './login.css';

const RoleSelection: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser, refreshUserProfile } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const email = firebaseUser?.email || '';

  const handleContinue = async () => {
    if (!selectedRole || submitting) return;
    setSubmitting(true);
    try {
      await createUserProfile({ role: selectedRole });
      await refreshUserProfile();
      clearAuthFlow();

      if (selectedRole === 'buyer') {
        sessionStorage.setItem('buyer_new_signup', '1');
        navigate('/home', { replace: true });
      } else {
        navigate('/create-username', { replace: true });
      }
    } catch {
      setSubmitting(false);
      toast.error('Something went wrong. Please try again.', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  };

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

      <div style={{ maxWidth: '440px', width: '100%', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 1rem' }}>
        <div className="login-form-container role-select-card">
          <div className="role-header">
            <h2 className="role-title">
              How would you like to use <span className="role-title-brand">BrushOwl</span>?
            </h2>
            <p className="role-subtitle">Choose the option that best describes you.</p>
          </div>

          <div className="onboarding-role-list" role="radiogroup" aria-label="Account type">
            <button
              type="button"
              role="radio"
              aria-checked={selectedRole === 'artist'}
              className={`onboarding-role-card${selectedRole === 'artist' ? ' is-selected' : ''}`}
              onClick={() => !submitting && setSelectedRole('artist')}
              disabled={submitting}
            >
              <span className="onboarding-role-icon onboarding-role-icon--artist">
                {MdBrush({ size: 22 })}
              </span>
              <span className="onboarding-role-body">
                <span className="onboarding-role-title">I&apos;m an Artist</span>
                <span className="onboarding-role-desc">
                  Sell your artwork, receive commission requests, and grow your audience.
                </span>
              </span>
              <span className={`onboarding-role-radio${selectedRole === 'artist' ? ' is-checked' : ''}`} aria-hidden="true" />
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={selectedRole === 'buyer'}
              className={`onboarding-role-card${selectedRole === 'buyer' ? ' is-selected' : ''}`}
              onClick={() => !submitting && setSelectedRole('buyer')}
              disabled={submitting}
            >
              <span className="onboarding-role-icon onboarding-role-icon--buyer">
                {MdShoppingBag({ size: 22 })}
              </span>
              <span className="onboarding-role-body">
                <span className="onboarding-role-title">I&apos;m a Buyer</span>
                <span className="onboarding-role-desc">
                  Discover original artwork and commission custom paintings.
                </span>
              </span>
              <span className={`onboarding-role-radio${selectedRole === 'buyer' ? ' is-checked' : ''}`} aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className="login-button primary-cta role-continue-btn"
            onClick={handleContinue}
            disabled={!selectedRole || submitting}
          >
            {submitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                Setting up…
                <span className="onboarding-role-spinner" aria-hidden="true" />
              </span>
            ) : (
              'Continue →'
            )}
          </button>

          {email && (
            <p className="role-signed-in">Signed in as {email}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
