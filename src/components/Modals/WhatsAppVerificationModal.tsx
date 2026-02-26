import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import './WhatsAppVerificationModal.css';

interface WhatsAppVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (phoneNumber: string) => void;
}

const WhatsAppVerificationModal: React.FC<WhatsAppVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified,
}) => {

  const { appUser } = useAuth();
  const { theme } = useTheme();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirmPhoneNumber, setConfirmPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

    if (!appUser?.uid) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber}`;
      console.log('💾 Saving WhatsApp number:', fullPhoneNumber);
      
      // Save to Firestore
      const userRef = doc(db, 'users', appUser.uid);
      await updateDoc(userRef, {
        whatsappNumber: fullPhoneNumber,
        whatsappVerified: false, // Not verified via OTP
        whatsappAddedAt: new Date(),
      });
      
      console.log('✅ WhatsApp number saved successfully');
      
      toast.success('WhatsApp number saved successfully!', {
        position: 'top-center',
        autoClose: 3000,
      });
      
      onVerified(fullPhoneNumber);
      handleClose();
    } catch (err: any) {
      console.error('❌ Error saving WhatsApp number:', err);
      setError(err.message || 'Failed to save WhatsApp number');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div className={`modal-content ${theme}`} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>
          ×
        </button>

        <div className="modal-header">
          <h2>Add WhatsApp Number</h2>
        
        </div>

        <div className="modal-body">
          <div className="phone-input-section">
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
            
            {/* Real-time mismatch warning */}
            {confirmPhoneNumber && phoneNumber && confirmPhoneNumber !== phoneNumber.substring(0, confirmPhoneNumber.length) && (
              <p className="error-message" style={{ marginTop: '5px' }}>
                Numbers do not match
              </p>
            )}
            
            {error && <p className="error-message">{error}</p>}
            
            <button
              className="primary-button"
              onClick={handleSave}
              disabled={loading || phoneNumber.length !== 10 || confirmPhoneNumber.length !== 10}
            >
              {loading ? 'Saving...' : 'Save WhatsApp Number'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WhatsAppVerificationModal;
