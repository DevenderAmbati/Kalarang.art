import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaWhatsapp } from 'react-icons/fa';
import './WhatsAppPromptModal.css';

interface WhatsAppPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (phoneNumber: string) => void;
  userId: string;
  inline?: boolean; // New prop for inline rendering
}

const WhatsAppPromptModal: React.FC<WhatsAppPromptModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  userId,
  inline = false, // Default to false for modal behavior
}) => {
  const { theme } = useTheme();
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirmPhoneNumber, setConfirmPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [error, setError] = useState('');

  const handleSkip = async () => {
    if (dontAskAgain) {
      setLoading(true);
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          dontAskWhatsApp: true,
        });
        console.log('✅ Updated dontAskWhatsApp preference');
      } catch (err) {
        console.error('❌ Error updating preference:', err);
      } finally {
        setLoading(false);
      }
    }
    onClose();
  };

  const handleSave = async () => {
    setError('');
    
    // Validate phone number
    if (!phoneNumber || phoneNumber.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    // Validate confirmation
    if (phoneNumber !== confirmPhoneNumber) {
      setError('Phone numbers do not match');
      return;
    }

    setLoading(true);
    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber}`;
      console.log('💾 Saving WhatsApp number:', fullPhoneNumber);
      
      // Save to Firestore
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        whatsappNumber: fullPhoneNumber,
        whatsappVerified: false,
        whatsappAddedAt: new Date(),
      });
      
      console.log('✅ WhatsApp number saved successfully');
      
      toast.success('WhatsApp number saved successfully!', {
        position: 'top-center',
        autoClose: 3000,
      });
      
      onSaved(fullPhoneNumber);
      onClose();
    } catch (err: any) {
      console.error('❌ Error saving WhatsApp number:', err);
      setError(err.message || 'Failed to save WhatsApp number');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Inline mode: render directly without portal or overlay
  if (inline) {
    return (
      <div style={{ maxWidth: '500px', width: '100%', zIndex: 10 }}>
        {/* Mobile Header */}
        <div className="login-mobile-header">
          <img
            src="/logo1.png"
            alt="Kalarang Logo"
            className="login-mobile-logo"
          />
          <h1 className="login-mobile-headline">Where Art Meets Its People</h1>
          <p className="login-mobile-subtext">Let buyers reach out to you directly</p>
        </div>

        <div className="login-form-container">
          <div className="login-header">
            <div className="login-welcome-back">Almost There!</div>
            <h2 className="login-title">Add WhatsApp Number</h2>
            <p className="login-subtitle">
              Enter your WhatsApp number so art enthusiasts can reach you directly
            </p>
          </div>

          <div className="login-form">
            <div className="login-input-group">
              <div className="login-input-wrapper" style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  className="login-input"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={loading}
                  style={{ 
                    maxWidth: '120px',
                    paddingLeft: '1rem',
                    paddingRight: '0.5rem'
                  }}
                >
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+971">🇦🇪 +971</option>
                </select>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="tel"
                    className="login-input"
                    placeholder=" "
                    value={phoneNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 10) {
                        setPhoneNumber(value);
                      }
                    }}
                    disabled={loading}
                    maxLength={10}
                  />
                  <label className={`login-floating-label ${phoneNumber ? 'login-floating-label-active' : ''}`}>
                    WhatsApp Number
                  </label>
                </div>
              </div>
            </div>

            <div className="login-input-group">
              <div className="login-input-wrapper" style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  className="login-input"
                  value={countryCode}
                  disabled
                  style={{ 
                    maxWidth: '120px',
                    paddingLeft: '1rem',
                    paddingRight: '0.5rem',
                    opacity: 0.7
                  }}
                >
                  <option value={countryCode}>{countryCode}</option>
                </select>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="tel"
                    className="login-input"
                    placeholder=" "
                    value={confirmPhoneNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 10) {
                        setConfirmPhoneNumber(value);
                      }
                    }}
                    disabled={loading}
                    maxLength={10}
                    style={{
                      borderColor: confirmPhoneNumber && phoneNumber && confirmPhoneNumber !== phoneNumber.substring(0, confirmPhoneNumber.length) 
                        ? '#ef4444' 
                        : undefined
                    }}
                  />
                  <label className={`login-floating-label ${confirmPhoneNumber ? 'login-floating-label-active' : ''}`}>
                    Confirm Number
                  </label>
                </div>
              </div>
            </div>
            
            {confirmPhoneNumber && phoneNumber && confirmPhoneNumber !== phoneNumber.substring(0, confirmPhoneNumber.length) && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '0.875rem',
                marginBottom: '1rem'
              }}>
                Phone numbers do not match
              </div>
            )}
            
            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '0.875rem',
                marginBottom: '1rem'
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                className="login-button secondary-cta"
                onClick={handleSkip}
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? 'Skipping...' : 'Skip for Now'}
              </button>
              <button
                className="login-button primary-cta"
                onClick={handleSave}
                disabled={loading || phoneNumber.length !== 10 || confirmPhoneNumber.length !== 10}
                style={{ flex: 1 }}
              >
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>

            <div style={{ 
              marginTop: '1.5rem',
              textAlign: 'center',
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dontAskAgain}
                  onChange={(e) => setDontAskAgain(e.target.checked)}
                  disabled={loading}
                  style={{ cursor: 'pointer' }}
                />
                <span>Don't ask me again</span>
              </label>
              <p style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
                You can always add this later from your profile page
              </p>
            </div>
          </div>
        </div>

        {/* Decorative corner elements */}
        <div className="login-corner-decor-1"></div>
        <div className="login-corner-decor-2"></div>
      </div>
    );
  }

  // Modal mode: render with portal and overlay (existing behavior)
  return createPortal(
    <div className="modal-overlay" onClick={handleSkip}>
      <div className={`whatsapp-prompt-modal ${theme}`} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleSkip}>
          ×
        </button>

        <div className="whatsapp-prompt-icon">
          {(FaWhatsapp as any)({ size: 64, color: "#25D366" })}
        </div>

        <div className="whatsapp-prompt-header">
          <h2>Add WhatsApp Number</h2>
          <p className="whatsapp-prompt-subtitle">
            Enter your WhatsApp number to let users reach you directly
          </p>
        </div>

        <div className="whatsapp-input-section">
              <div className="phone-input-group">
                <select
                  className="country-code-select"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={loading}
                >
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+971">🇦🇪 +971</option>
                </select>
                <input
                  type="tel"
                  className="phone-input"
                  placeholder="Enter WhatsApp number"
                  value={phoneNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 10) {
                      setPhoneNumber(value);
                    }
                  }}
                  disabled={loading}
                  maxLength={10}
                />
              </div>

              <div className="phone-input-group">
                <select
                  className="country-code-select"
                  value={countryCode}
                  disabled
                >
                  <option value={countryCode}>{countryCode}</option>
                </select>
                <input
                  type="tel"
                  className="phone-input"
                  placeholder="Confirm number"
                  value={confirmPhoneNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 10) {
                      setConfirmPhoneNumber(value);
                    }
                  }}
                  disabled={loading}
                  maxLength={10}
                  style={{
                    borderColor: confirmPhoneNumber && phoneNumber && confirmPhoneNumber !== phoneNumber.substring(0, confirmPhoneNumber.length) 
                      ? '#f44336' 
                      : undefined
                  }}
                />
              </div>
              
              {confirmPhoneNumber && phoneNumber && confirmPhoneNumber !== phoneNumber.substring(0, confirmPhoneNumber.length) && (
                <p className="error-message" style={{ marginTop: '5px' }}>
                  Numbers do not match
                </p>
              )}
              
              {error && <p className="error-message">{error}</p>}

            <div className="whatsapp-prompt-actions">
              <button
                className="whatsapp-skip-button"
                onClick={handleSkip}
                disabled={loading}
              >
                {loading ? 'Skipping...' : 'Skip for Now'}
              </button>
              <button
                className="whatsapp-add-button"
                onClick={handleSave}
                disabled={loading || phoneNumber.length !== 10 || confirmPhoneNumber.length !== 10}
              >
                {loading ? 'Saving...' : 'Save Number'}
              </button>
            </div>
        </div>

        <div className="whatsapp-prompt-footer">
          <label className="dont-ask-checkbox">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              disabled={loading}
            />
            <span>Don't ask me again</span>
          </label>
          <p className="whatsapp-prompt-note">
            You can always add this later from your profile page
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WhatsAppPromptModal;
