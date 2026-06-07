import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './ReachoutModal.css';

interface ReachoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  artworkId: string;
  artworkImage: string;
  artworkTitle: string;
  artworkDescription: string;
  artistName: string;
}

const ReachoutModal: React.FC<ReachoutModalProps> = ({
  isOpen,
  onClose,
  onSend,
  artworkId,
  artworkImage,
  artworkTitle,
  artworkDescription,
  artistName,
}) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSend = () => {
    if (!message.trim()) {
      return; // Don't send empty messages
    }
    onSend(message);
    setMessage('');
    onClose();
  };

  const handleCardClick = () => {
    onClose();
    navigate(`/card/${artworkId}`);
  };

  return createPortal(
    <div className="reachout-modal-overlay" onClick={handleOverlayClick}>
      <div className="reachout-modal-content">
        <div className="reachout-modal-header">
          <h2 className="reachout-modal-title">Reach Out to {artistName}</h2>
          <button className="reachout-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="reachout-artwork-card" onClick={handleCardClick}>
          <div className="reachout-artwork-image">
            <img src={artworkImage} alt={artworkTitle} />
          </div>
          <div className="reachout-artwork-details">
            <h3 className="reachout-artwork-title">{artworkTitle}</h3>
            <p className="reachout-artwork-description">
              {artworkDescription.length > 100 
                ? `${artworkDescription.substring(0, 100)}...` 
                : artworkDescription}
            </p>
          </div>
          <div className="reachout-artwork-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <div className="reachout-message-container">
          <label htmlFor="reachout-message" className="reachout-message-label">
            Your Message
          </label>
          <textarea
            id="reachout-message"
            className="reachout-message-input"
            placeholder={`Tell ${artistName} what interests you about this artwork...`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
        </div>

        <div className="reachout-modal-actions">
          <button
            className="reachout-modal-btn reachout-modal-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="reachout-modal-btn reachout-modal-btn-send"
            onClick={handleSend}
            disabled={!message.trim()}
          >
            Send Message
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReachoutModal;
