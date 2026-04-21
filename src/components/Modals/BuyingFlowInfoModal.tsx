import React from 'react';
import { createPortal } from 'react-dom';
import './CommissionFlowInfoModal.css';

interface BuyingFlowInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'artist' | 'buyer';
}

const BuyingFlowInfoModal: React.FC<BuyingFlowInfoModalProps> = ({
  isOpen,
  onClose,
  userRole,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const artistSteps = [
    {
      title: '1. Upload Artwork',
      description: 'Post your readymade paintings via the "Upload Artwork" tab. Add clear photos, a title, description, dimensions, medium, and price.',
    },
    {
      title: '2. Add Your UPI ID',
      description: 'Make sure you add your UPI ID in your profile, so that buyers can pay directly to you.',
    },
    {
      title: '3. Buyer Enquiries',
      description: "Buyers will contact you through chat about artworks they're interested in.",
    },
    {
      title: '4. Send Final Offer',
      description: 'Send a formal offer to the buyer with the final price and estimated delivery time.',
    },
    {
      title: '5. Receive Payment',
      description: 'Buyer pays via UPI shown in the chat. Confirm payment before shipping.',
    },
    {
      title: '6. Ship Artwork',
      description: 'Package the artwork carefully and ship to the buyer\'s address. Share the tracking number in chat.',
    },
    {
      title: '7. Complete Sale & Get Review',
      description: 'Once the buyer receives the artwork, they leave a review. You can reply to their review.',
    },
  ];

  const buyerSteps = [
    {
      title: '1. Browse & Explore',
      description: 'Browse artworks in the Explore tab. Filter by style, medium, or price to find what you love.',
    },
    {
      title: '2. Save Favourites',
      description: 'Bookmark artworks you like to revisit them later.',
    },
    {
      title: '3. Buy Now',
      description: 'Click on Buy Now, add your shipping address, and make payment directly to the artist.',
    },
    {
      title: '4. Chat & Accept Offer',
      description: 'Chat with the artist about the artwork and price. Once agreed, the artist sends a formal offer — accept it and pay via UPI shown in the chat.',
    },
    {
      title: '5. Track Shipment',
      description: 'The artist will share a tracking number once shipped. Track delivery to your address.',
    },
    {
      title: '6. Receive & Review',
      description: 'Receive the artwork and leave a review for the artist. Enjoy your new piece!',
    },
  ];

  const steps = userRole === 'artist' ? artistSteps : buyerSteps;

  return createPortal(
    <div className="commission-flow-info-overlay" onClick={handleOverlayClick}>
      <div className="commission-flow-info-content">
        <div className="commission-flow-info-header">
          <h2 className="commission-flow-info-title">
            {userRole === 'artist' ? 'Selling Artwork - Artist Guide' : 'Buying Artwork - Buyer Guide'}
          </h2>
          <button
            className="commission-flow-info-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="commission-flow-info-steps">
          {steps.map((step, index) => (
            <div key={index} className="commission-flow-info-step">
              <div className="commission-flow-info-step-header">
                <div className="commission-flow-info-step-number">{index + 1}</div>
                <h3 className="commission-flow-info-step-title">{step.title.replace(/^\d+\.\s*/, '')}</h3>
              </div>
              <p className="commission-flow-info-step-description">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="commission-flow-info-footer">
          <button
            className="commission-flow-info-btn"
            onClick={onClose}
          >
            OK, Got it!
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BuyingFlowInfoModal;
