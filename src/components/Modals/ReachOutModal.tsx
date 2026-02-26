import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { toast } from 'react-toastify';
import { createNotification } from '../../services/notificationService';
import './ReachOutModal.css';

interface ReachOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistId: string;
  artistName: string;
  artistEmail: string;
  artistAvatar: string;
  artistWhatsApp?: string;
  artworkId: string;
  artworkTitle: string;
  artworkImage?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
}

const ReachOutModal: React.FC<ReachOutModalProps> = ({
  isOpen,
  onClose,
  artistId,
  artistName,
  artistEmail,
  artistAvatar,
  artistWhatsApp,
  artworkId,
  artworkTitle,
  artworkImage,
  userId,
  userName,
  userEmail,
  userAvatar,
}) => {
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSending) {
      onClose();
    }
  };

  const handleEmailClick = async () => {
    setIsSending(true);
    try {
      console.log('[ReachOutModal] Sending artist reach-out email...', {
        artistName,
        artistEmail,
        artworkTitle,
        userName,
        userEmail,
      });

      const sendArtistEmail = httpsCallable(functions, 'sendArtistReachOut');
      
      const result = await sendArtistEmail({
        artistName,
        artistEmail,
        artworkTitle,
        userName,
        userEmail,
      });

      console.log('[ReachOutModal] Email sent successfully:', result);
      
      // Create notification for artist
      try {
        await createNotification(
          artistId,
          'reachout',
          userId,
          userName,
          userAvatar,
          artworkId,
          artworkTitle,
          artworkImage,
          'email'
        );
        console.log('[ReachOutModal] Notification created successfully');
      } catch (notifError) {
        console.error('[ReachOutModal] Error creating notification:', notifError);
      }
      
      toast.success('Email sent successfully! The artist will receive your message.');
      onClose();
    } catch (error: any) {
      console.error('[ReachOutModal] Error sending email:', error);
      console.error('[ReachOutModal] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleWhatsAppClick = () => {
    if (!artistWhatsApp) return;

    // Clean the phone number (remove spaces, dashes, etc.)
    const cleanNumber = artistWhatsApp.replace(/[^\d+]/g, '');
    
    // Pre-filled message
    const message = `Hi ${artistName}! 👋

I came across your artwork *"${artworkTitle}"* on Kalarang and I'm really impressed!

I would love to learn more about purchasing your art.
Looking forward to connecting with you!

Best regards,
${userName}

_Sent via Kalarang - Connecting Art & Artists_`;
    
    // WhatsApp link format: https://wa.me/<number>?text=<message>
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp in a new tab
    window.open(whatsappUrl, '_blank');
    
    // Create notification for artist
    createNotification(
      artistId,
      'reachout',
      userId,
      userName,
      userAvatar,
      artworkId,
      artworkTitle,
      artworkImage,
      'whatsapp'
    ).then(() => {
      console.log('[ReachOutModal] WhatsApp notification created');
    }).catch((error) => {
      console.error('[ReachOutModal] Error creating WhatsApp notification:', error);
    });
    
    toast.info('Opening WhatsApp...');
    onClose();
  };

  return createPortal(
    <div className="reachout-modal-overlay" onClick={handleOverlayClick}>
      <div className="reachout-modal-content">
        <button
          className="reachout-modal-close"
          onClick={onClose}
          disabled={isSending}
          aria-label="Close"
        >
          ×
        </button>

        <div className="reachout-modal-header">
          <h2 className="reachout-modal-title">Reach Out to Artist</h2>
          <p className="reachout-modal-subtitle">Choose how you'd like to connect</p>
        </div>

        <div className="reachout-modal-artist-info">
          <img
            src={artistAvatar}
            alt={artistName}
            className="reachout-modal-artist-avatar"
          />
          <div className="reachout-modal-artist-details">
            <h3 className="reachout-modal-artist-name">{artistName}</h3>
            <p className="reachout-modal-artwork-title">About: {artworkTitle}</p>
          </div>
        </div>

        <div className="reachout-modal-options">
          {/* Email Option */}
          <button
            className="reachout-option-btn"
            onClick={handleEmailClick}
            disabled={isSending}
          >
            <div className="reachout-option-icon email">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div className="reachout-option-content">
              <h3 className="reachout-option-title">Send Email</h3>
              <p className="reachout-option-description">
                {isSending ? 'Sending...' : 'Send a professional email to the artist'}
              </p>
            </div>
            <span className="reachout-option-arrow">→</span>
          </button>

          {/* WhatsApp Option - Only show if artist has WhatsApp */}
          {artistWhatsApp && (
            <button
              className="reachout-option-btn"
              onClick={handleWhatsAppClick}
              disabled={isSending}
            >
              <div className="reachout-option-icon whatsapp">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </div>
              <div className="reachout-option-content">
                <h3 className="reachout-option-title">WhatsApp Chat</h3>
                <p className="reachout-option-description">
                  Start a direct conversation on WhatsApp
                </p>
              </div>
              <span className="reachout-option-arrow">→</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReachOutModal;
