import React, { useState, useEffect } from 'react';
import { FaUserPlus, FaHeart, FaHandshake, FaCheckCircle, FaCommentDots, FaReply, FaThumbsUp, FaBox, FaTruck, FaStar } from 'react-icons/fa';
import { IoIosChatbubbles } from 'react-icons/io';
import { MdClose, MdWork, MdLocalOffer } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { 
  subscribeToNotifications, 
  markAllNotificationsAsRead, 
  markNotificationAsRead,
  deleteOldReadNotifications,
  Notification 
} from '../../services/notificationService';
import './NotificationModal.css';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose }) => {
  const { appUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    
    setLoading(true);
    
    // Delete old read notifications (older than 30 days)
    deleteOldReadNotifications(appUser.uid).catch(error => {
    });
    
    // Subscribe to real-time notifications
    const unsubscribe = subscribeToNotifications(appUser.uid, (fetchedNotifications) => {
      setNotifications(fetchedNotifications);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [appUser]);

  const handleMarkAllAsRead = async () => {
    if (!appUser) return;
    
    try {
      await markAllNotificationsAsRead(appUser.uid);
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      onClose();
    } catch (error) {
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications(notifications.map(n => 
          n.id === notification.id ? { ...n, isRead: true } : n
        ));
        onClose();
      } catch (error) {
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return FaUserPlus({ size: 20, className: 'notification-icon follow' });
      case 'reachout':
        return IoIosChatbubbles({ size: 20, className: 'notification-icon reachout chat' });
      case 'favourite':
        return FaHeart({ size: 20, className: 'notification-icon favourite' });
      case 'like':
        return FaThumbsUp({ size: 20, className: 'notification-icon artwork-like' });
      case 'comment':
        return FaCommentDots({ size: 20, className: 'notification-icon comment' });
      case 'comment_reply':
        return FaReply({ size: 20, className: 'notification-icon comment-reply' });
      case 'commission_application':
        return MdWork({ size: 20, className: 'notification-icon commission' });
      case 'commission_offer':
        return MdLocalOffer({ size: 20, className: 'notification-icon commission' });
      case 'commission_offer_accepted':
        return FaHandshake({ size: 20, className: 'notification-icon commission-success' });
      case 'commission_completed':
        return FaCheckCircle({ size: 20, className: 'notification-icon commission-success' });
      case 'ready_to_ship':
        return FaBox({ size: 20, className: 'notification-icon commission' });
      case 'full_payment_done':
        return FaCheckCircle({ size: 20, className: 'notification-icon commission-success' });
      case 'commission_shipped':
        return FaTruck({ size: 20, className: 'notification-icon commission' });
      case 'review_received':
        return FaStar({ size: 20, className: 'notification-icon favourite' });
      case 'review_reply':
        return FaReply({ size: 20, className: 'notification-icon comment-reply' });
      default:
        return null;
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'follow':
        return (
          <>
            <strong>{notification.actorName}</strong> started following you
          </>
        );
      case 'reachout':
        return (
          <>
            <strong>{notification.actorName}</strong> reached out for{' '}
            <strong>{notification.artworkTitle}</strong>
          </>
        );
      case 'favourite':
        return (
          <>
            <strong>{notification.actorName}</strong> added <strong>{notification.artworkTitle}</strong> to favourites
          </>
        );
      case 'like':
        return (
          <>
            <strong>{notification.actorName}</strong> liked{' '}
            {notification.artworkTitle && <strong>{notification.artworkTitle}</strong>}
          </>
        );
      case 'comment':
        return (
          <>
            <strong>{notification.actorName}</strong> commented on{' '}
            {notification.artworkTitle && <strong>{notification.artworkTitle}</strong>}
            {notification.commentSnippet && (
              <>
                {': '}
                <span className="notification-inline-snippet">“{notification.commentSnippet}”</span>
              </>
            )}
          </>
        );
      case 'comment_reply':
        return (
          <>
            <strong>{notification.actorName}</strong> replied to your comment
            {notification.artworkTitle && (
              <>
                {' on '}<strong>{notification.artworkTitle}</strong>
              </>
            )}
            {notification.commentSnippet && (
              <>
                {' — '}
                <span className="notification-inline-snippet">“{notification.commentSnippet}”</span>
              </>
            )}
          </>
        );
      case 'commission_application':
        return (
          <>
            <strong>{notification.actorName}</strong> applied to your commission{' '}
            {notification.commissionTitle && <strong>"{notification.commissionTitle}"</strong>}
          </>
        );
      case 'commission_offer':
        return (
          <>
            <strong>{notification.actorName}</strong> sent you an offer for{' '}
            {notification.commissionTitle && <strong>"{notification.commissionTitle}"</strong>}
          </>
        );
      case 'commission_offer_accepted':
        return notification.commentSnippet === 'payment_done' ? (
          <>
            <strong>{notification.actorName}</strong> made payment for{' '}
            {notification.commissionTitle && <strong>"{notification.commissionTitle}"</strong>}
            {'. Please start shipping to the address provided.'}
          </>
        ) : (
          <>
            <strong>{notification.actorName}</strong> accepted your offer for{' '}
            {notification.commissionTitle && <strong>"{notification.commissionTitle}"</strong>}
            {' — you can start the work!'}
          </>
        );
      case 'commission_completed':
        return (
          <>
            Your commission{' '}
            {notification.commissionTitle && <strong>"{notification.commissionTitle}"</strong>}
            {' has been marked as completed'}
          </>
        );
      case 'ready_to_ship':
        return (
          <>
            {'Your artwork '}
            {notification.commissionTitle && <strong>"{notification.commissionTitle}"</strong>}
            {' is ready to ship. Please check in chat.'}
          </>
        );
      case 'full_payment_done':
        return (
          <>
            <strong>{notification.actorName}</strong>
            {' has paid the full amount for '}
            {notification.commissionTitle && <strong>"{notification.commissionTitle}"</strong>}
            {'. You can start shipping the artwork.'}
          </>
        );
      case 'commission_shipped':
        return (
          <>
            <strong>{notification.actorName}</strong>
            {' has shipped '}
            {notification.commissionTitle && <strong>"{notification.commissionTitle}"</strong>}
            {'. Tracking ID: '}
            <strong>{notification.commentSnippet}</strong>
          </>
        );
      case 'review_received': {
        const rating = notification.commentSnippet ? parseInt(notification.commentSnippet, 10) : 0;
        return (
          <>
            <strong>{notification.actorName}</strong>
            {' left a review for '}
            {notification.commissionTitle && <strong>"{notification.commissionTitle}"</strong>}
            {rating > 0 && (
              <span className="notification-review-stars">
                {[1,2,3,4,5].map((s) => (
                  <span key={s} style={{ color: s <= rating ? '#f59e0b' : '#d1d5db', fontSize: '0.85rem' }}>★</span>
                ))}
              </span>
            )}
          </>
        );
      }
      case 'review_reply':
        return (
          <>
            <strong>{notification.actorName}</strong>
            {' replied to your review for '}
            {notification.commissionTitle && <strong>"{notification.commissionTitle}"</strong>}
            {notification.commentSnippet && (
              <>
                {': '}
                <span className="notification-inline-snippet">"{notification.commentSnippet}"</span>
              </>
            )}
          </>
        );
      default:
        return null;
    }
  };

  const getTimeAgo = (timestamp: Date) => {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return timestamp.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="notification-modal-overlay" onClick={onClose} />
      <div className="notification-modal">
        <div className="notification-modal-header">
          <h2>Notifications</h2>
          <button className="notification-modal-close" onClick={onClose}>
            {MdClose({ size: 24 })}
          </button>
        </div>
        
        <div className="notification-modal-content">
          {loading ? (
            <div className="notification-loading">
              <p>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-avatar">
                    <img src={notification.actorAvatar || '/artist.png'} alt={notification.actorName} />
                    <div className="notification-icon-badge">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>
                  
                  <div className="notification-content">
                    <p className="notification-text">
                      {getNotificationText(notification)}
                    </p>
                    <span className="notification-time">{getTimeAgo(notification.timestamp)}</span>
                  </div>
                  
                  {notification.artworkImage && (
                    <div className="notification-artwork">
                      <img src={notification.artworkImage} alt={notification.artworkTitle} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="notification-modal-footer">
          <button className="notification-mark-all-read" onClick={handleMarkAllAsRead}>
            Mark all as read
          </button>
        </div>
      </div>
    </>
  );
};

export default NotificationModal;
