import React from 'react';
import { createPortal } from 'react-dom';
import { MdPersonAddAlt1 } from 'react-icons/md';
import './ConfirmModal.css';

interface NewGoogleAccountModalProps {
  isOpen: boolean;
  email?: string;
  isLoading?: boolean;
  onClose: () => void;
  onContinue: () => void;
  onUseAnotherAccount: () => void;
}

const NewGoogleAccountModal: React.FC<NewGoogleAccountModalProps> = ({
  isOpen,
  email,
  isLoading = false,
  onClose,
  onContinue,
  onUseAnotherAccount,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return createPortal(
    <div className="confirm-modal-overlay" onClick={handleOverlayClick}>
      <div className="confirm-modal-content">
        <div className="confirm-modal-icon confirm-modal-icon-info">
          {MdPersonAddAlt1({ size: 32 })}
        </div>
        <h2 className="confirm-modal-title">No BrushOwl account found</h2>
        <p className="confirm-modal-message">
          {email ? (
            <>
              No BrushOwl account is associated with <strong>{email}</strong>.
              <br />
              Would you like to create a new account using this Google account, or choose another Google account?
            </>
          ) : (
            <>
              No BrushOwl account is associated with this Google account.
              <br />
              Would you like to create a new account using this Google account, or choose another Google account?
            </>
          )}
        </p>
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-btn confirm-modal-btn-cancel"
            onClick={onUseAnotherAccount}
            disabled={isLoading}
          >
            Choose another Google account
          </button>
          <button
            type="button"
            className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
            onClick={onContinue}
            disabled={isLoading}
          >
            {isLoading ? 'Please wait…' : 'Continue with this account'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NewGoogleAccountModal;
