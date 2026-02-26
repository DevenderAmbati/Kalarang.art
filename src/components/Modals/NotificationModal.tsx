import React, { useState, useEffect } from 'react';
import { FaUserPlus, FaHeart } from 'react-icons/fa';
import { IoLogoWhatsapp } from 'react-icons/io';
import { MdEmail, MdClose } from 'react-icons/md';
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
      console.error('Error deleting old notifications:', error);
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
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications(notifications.map(n => 
          n.id === notification.id ? { ...n, isRead: true } : n
        ));
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
  };

  const getNotificationIcon = (type: string, contactMethod?: string) => {
    switch (type) {
      case 'follow':
        return FaUserPlus({ size: 20, className: 'notification-icon follow' });
      case 'reachout':
        return contactMethod === 'whatsapp' 
          ? IoLogoWhatsapp({ size: 20, className: 'notification-icon reachout whatsapp' })
          : MdEmail({ size: 20, className: 'notification-icon reachout email' });
      case 'favourite':
        return FaHeart({ size: 20, className: 'notification-icon favourite' });
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
            <strong>{notification.actorName}</strong> reached out via {notification.contactMethod === 'whatsapp' ? 'WhatsApp' : 'Email'} for{' '}
            <strong>{notification.artworkTitle}</strong>
          </>
        );
      case 'favourite':
        return (
          <>
            <strong>{notification.actorName}</strong> added <strong>{notification.artworkTitle}</strong> to favourites
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
                      {getNotificationIcon(notification.type, notification.contactMethod)}
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
