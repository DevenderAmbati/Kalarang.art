import React from 'react';
import { createPortal } from 'react-dom';
import './CommissionFlowInfoModal.css';

interface CommissionFlowInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'artist' | 'buyer';
}

const CommissionFlowInfoModal: React.FC<CommissionFlowInfoModalProps> = ({
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
      title: '1. Browse & Shortlist',
      description: 'Explore open commission requests and bookmark ones that match your expertise.',
    },
    {
      title: '2. Apply',
      description: 'Send a message to introduce yourself and discuss the project details with the buyer.',
    },
    {
      title: '3. Send Offer',
      description: 'Once you understand the requirements, send an offer with your price, advance amount, and delivery date.',
    },
    {
      title: '4. Buyer Accepts',
      description: 'Wait for the buyer to review and accept your offer.',
    },
    {
      title: '5. Receive Advance Payment',
      description: 'The buyer pays the advance amount via UPI. Also address details will be provided in the chat.',
    },
    {
      title: '6. Create Artwork',
      description: 'Work on the commission according to the agreed requirements and deadline.',
    },
    {
      title: '7. Upload & Mark Ready',
      description:  'Once the artwork is ready, click on "Ready to Ship" button in the chat and upload the final image for the buyer to review.',
    },
    {
      title: '8. Receive Final Payment',
      description: 'Once the buyer is satisfied, they will pay the remaining amount via UPI.',
    },
    {
      title: '9. Ship Physical Artwork',
      description: 'Ship the artwork by yourself to the address provided by the buyer. Click "Make shipment" button in the chat and enter the tracking number.',
    },
    {
      title: '10. Completion & Review',
      description: 'Buyer provides you the review. You can reply to their review.',
    },
  ];

  const buyerSteps = [
    {
      title: '1. Post Commission Request',
      description: 'Create a detailed request with your requirements, budget, deadline, and reference images.',
    },
    {
      title: '2. Review Applications',
      description: 'Artists will send messages. Review their profiles and chat with interested artists.',
    },
    {
      title: '3. Receive Offers',
      description: 'Artists will send formal offers with price, delivery date, and advance amount.',
    },
    {
      title: '4. Accept, Provide Address & Pay Advance',
      description: 'Choose the artist and accept their offer. This closes your request to other artists. Provide your address and pay the advance amount via UPI shown.',
    },
    {
      title: '5. Artist Creates Artwork',
      description: 'The artist works on your commission. You can message them for updates.',
    },
    {
      title: '6. Review Artwork',
      description: 'The artist uploads the final artwork. Review it in the chat.',
    },
    {
      title: '7. Make Final Payment',
      description: 'If satisfied, pay the remaining amount via UPI, by clicking on the "Make Payment" button in the chat. If not, you can ask the artist to make changes.',
    },
    {
      title: '8. Receive Delivery',
      description: 'Track the shipment by the tracking number provided by the artist. Receive the artwork at your address.',
    },
    {
      title: '9. Order Complete & Review',
      description: 'Once received, leave a review for the artist.',
    },
  ];

  const steps = userRole === 'artist' ? artistSteps : buyerSteps;

  return createPortal(
    <div className="commission-flow-info-overlay" onClick={handleOverlayClick}>
      <div className="commission-flow-info-content">
        <div className="commission-flow-info-header">
          <h2 className="commission-flow-info-title">
            {userRole === 'artist' ? 'Commission Flow - Artist Guide' : 'Commission Flow - Buyer Guide'}
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

export default CommissionFlowInfoModal;
