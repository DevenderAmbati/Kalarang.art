import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './FollowersModal.css';

interface UserItem {
  uid: string;
  name: string;
  username?: string;
  avatar?: string;
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'followers' | 'following';
  users: UserItem[];
  isLoading?: boolean;
  onRemoveFollower?: (userId: string) => void;
  onUnfollow?: (userId: string) => void;
}

const FollowersModal: React.FC<FollowersModalProps> = ({
  isOpen,
  onClose,
  type,
  users,
  isLoading = false,
  onRemoveFollower,
  onUnfollow,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUserClick = (userId: string) => {
    onClose();
    sessionStorage.setItem('artworkSourceRoute', location.pathname);
    navigate(`/portfolio/${userId}`);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="followers-modal-overlay" onClick={handleOverlayClick}>
      <div className="followers-modal-content">
        <div className="followers-modal-header">
          <h2>{type === 'followers' ? 'Followers' : 'Following'}</h2>
          <button className="followers-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="followers-modal-body">
          {isLoading ? (
            <div className="followers-modal-loading">
              <div className="loading-spinner"></div>
              <p>Loading...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="followers-modal-empty">
              <p>
                {type === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone yet'}
              </p>
            </div>
          ) : (
            <div className="followers-list">
              {users.map((user) => (
                <div
                  key={user.uid}
                  className="follower-item"
                >
                  <div 
                    className="follower-item-content"
                    onClick={() => handleUserClick(user.uid)}
                  >
                    <img
                      src={user.avatar || '/artist.png'}
                      alt={user.name}
                      className="follower-avatar"
                    />
                    <div className="follower-info">
                      <p className="follower-name">{user.name}</p>
                      {user.username && (
                        <p className="follower-username">@{user.username}</p>
                      )}
                    </div>
                  </div>
                  {type === 'followers' && onRemoveFollower && (
                    <button
                      className="follower-action-btn remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFollower(user.uid);
                      }}
                    >
                      Remove
                    </button>
                  )}
                  {type === 'following' && onUnfollow && (
                    <button
                      className="follower-action-btn unfollow-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnfollow(user.uid);
                      }}
                    >
                      Unfollow
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowersModal;
