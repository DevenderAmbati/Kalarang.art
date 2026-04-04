import React, { useState } from 'react';
import { BsPencil, BsPersonCircle, BsShare } from 'react-icons/bs';
import { MdEmail } from 'react-icons/md';
import BannerCropModal from '../Modals/BannerCropModal';
import AvatarCropModal from '../Modals/AvatarCropModal';
import './ProfileHeader.css';

interface ProfileStats {
  followers: number;
  artworks: number;
  following: number;
  customized: number;
}

interface User {
  name: string;
  username?: string;
  avatar?: string;
  bannerImage?: string;
  stats: ProfileStats;
  isFoundingArtist?: boolean;
}

interface ProfileHeaderProps {
  user: User;
  onEditProfile?: () => void;
  onShareProfile?: () => void;
  onBannerUpdate?: (newBannerUrl: string, originalImageUrl?: string) => void;
  onAvatarUpdate?: (newAvatarUrl: string) => void;
  originalBannerImage?: string;
  isOwner?: boolean;
  isFollowing?: boolean;
  onFollow?: () => void;
  onReachOut?: () => void;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
  rating?: { avg: number; count: number };
  onRatingClick?: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  onEditProfile,
  onShareProfile,
  onBannerUpdate,
  onAvatarUpdate,
  originalBannerImage,
  isOwner = false,
  isFollowing = false,
  onFollow,
  onReachOut,
  onFollowersClick,
  onFollowingClick,
  rating,
  onRatingClick,
}) => {
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handleAvatarEdit = () => {
    setIsAvatarModalOpen(true);
  };

  const handleAvatarSave = (croppedImageUrl: string) => {
    if (onAvatarUpdate) {
      onAvatarUpdate(croppedImageUrl);
    }
  };

  const handleBannerEdit = () => {
    setIsBannerModalOpen(true);
  };

  const handleBannerSave = (croppedImageUrl: string) => {
    if (onBannerUpdate) {
      onBannerUpdate(croppedImageUrl);
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const getAvatarBackgroundColor = (name: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="profile-header">
      {isOwner && (
        <button
          className="banner-edit-btn"
          onClick={handleBannerEdit}
          aria-label="Edit banner"
        >
          {(BsPencil as any)({ size: 18 })}
        </button>
      )}
      
      {/* Full Width Banner Section */}
      <div className="profile-banner">
        <div className="banner-image">
          <img
            key={user.bannerImage}
            src={user.bannerImage || '/logo.jpeg'}
            alt="Profile banner"
            className="banner-img"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== '/logo.jpeg') {
                target.src = '/logo.jpeg';
              }
            }}
          />
          <div className="banner-overlay" />
        </div>
      </div>

      {/* Profile Content - Centered Container */}
      <div className="profile-header-direct" style={{
        width: '100%',
        background: 'transparent',
        padding: '0',
        margin: '0'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 0.5rem'
        }}>
          {/* Avatar Section */}
          <div className="avatar-section" style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center'
          }}>
            <div className="avatar-container" style={{
              position: 'relative',
              display: 'inline-block',
              background: 'white',
              borderRadius: '50%'
            }}>
              <img
                src={user.avatar || '/artist.png'}
                alt={`${user.name}'s avatar`}
                className="profile-avatar"
                style={{
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block',
                  backgroundColor: '#f3f4f6'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  // If it's not already the artist.png, try that as fallback
                  if (target.src.indexOf('/artist.png') === -1) {
                    target.src = '/artist.png';
                  } else {
                    target.style.display = 'none';
                    // Show initials div as final fallback
                    const initialsDiv = target.nextElementSibling as HTMLElement;
                    if (initialsDiv) {
                      initialsDiv.style.display = 'flex';
                    }
                  }
                }}
              />
              <div
                className="profile-avatar profile-avatar-initials"
                style={{
                  display: 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: getAvatarBackgroundColor(user.name),
                  fontWeight: 'bold',
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  position: 'absolute',
                  top: 0,
                  left: 0
                }}
              >
                {getInitials(user.name)}
              </div>
              {isOwner && (
                <button
                  className="avatar-edit-btn"
                  onClick={handleAvatarEdit}
                  aria-label="Edit profile picture"
                >
                  {(BsPencil as any)({ className: "edit-icon" })}
                </button>
              )}
            </div>
            
            {/* User Name */}
            <h1 className="user-name">{user.name}</h1>
            {(user.username || user.isFoundingArtist) && (
              <div className="profile-header-username-row" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.25rem',
                marginBottom: '0.5rem',
                flexWrap: 'wrap'
              }}>
                {user.username && (
                  <p style={{
                    fontSize: '0.95rem',
                    color: 'var(--color-primary)',
                    margin: 0,
                    fontWeight: 500
                  }}>
                    @{user.username}
                  </p>
                )}
                {user.isFoundingArtist && (
                  <img
                    src="/founding badge.png"
                    alt="Founding Artist"
                    className="founding-artist-badge"
                    title="Founding Artist"
                  />
                )}
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="stats-section" style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
            width: 'fit-content',
            maxWidth: '600px'
          }}>
            <div
              className="stat-item"
              onClick={isOwner ? onFollowersClick : undefined}
              style={{
                cursor: isOwner ? 'pointer' : 'default',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (isOwner) e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                if (isOwner) e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span className="stat-number">{formatNumber(user.stats.followers)}</span>
              <span className="stat-label">Followers</span>
            </div>
            <span style={{ fontSize: '1.5rem', color: '#22d5c0ff', lineHeight: 1, margin: '0 0.3rem' }}>|</span>
            <div className="stat-item">
              <span className="stat-number">{formatNumber(user.stats.artworks)}</span>
              <span className="stat-label">Artworks</span>
            </div>
            <span style={{ fontSize: '1.5rem', color: '#22d5c0ff', lineHeight: 1, margin: '0 0.3rem' }}>|</span>
            <div className="stat-item">
              <span className="stat-number">{formatNumber(user.stats.customized)}</span>
              <span className="stat-label">Customized</span>
            </div>
            {rating && rating.count > 0 && (
              <>
                <span style={{ fontSize: '1.5rem', color: '#22d5c0ff', lineHeight: 1, margin: '0 0.3rem' }}>|</span>
                <div
                  className="stat-item"
                  onClick={onRatingClick}
                  style={{ cursor: onRatingClick ? 'pointer' : 'default', transition: 'transform 0.2s ease' }}
                  onMouseEnter={(e) => { if (onRatingClick) e.currentTarget.style.transform = 'scale(1.05)'; }}
                  onMouseLeave={(e) => { if (onRatingClick) e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <span className="stat-number" style={{ display: 'flex', alignItems: 'baseline', gap: '0.15rem' }}>
                    <span style={{ color: '#f59e0b' }}>★</span>
                    {rating.avg.toFixed(1)}
                   
                  </span>
                  <span className="stat-label">{rating.count} {rating.count === 1 ? 'Rating' : 'Ratings'}</span>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="action-buttons" style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%'
          }}>
            <button
              className="btn btn-primary"
              style={{
                padding: '0.75rem 1.2rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                justifyContent: 'center',
                whiteSpace: 'nowrap'
              }}
              onClick={onShareProfile}
              aria-label="Share profile"
            >
              {(BsShare as any)({ className: "btn-icon" })}
              Share Profile
            </button>
            
            <button
              className="btn btn-secondary"
              style={{
                padding: '0.75rem 1.2rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all var(--transition-base)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                outline: 'none',
                border: '2px solid var(--color-primary)',
                fontFamily: 'inherit',
                background: 'transparent',
                color: 'var(--color-primary)',
                justifyContent: 'center',
                whiteSpace: 'nowrap'
              }}
              onClick={isOwner ? onEditProfile : onFollow}
              aria-label={isOwner ? "Edit profile" : (isFollowing ? "Unfollow" : "Follow")}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary-alpha-10)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {isOwner ? (
                <>
                  {(BsPencil as any)({ className: "btn-icon" })}
                  Edit Profile
                </>
              ) : (
                <>
                  {(BsPersonCircle as any)({ className: "btn-icon" })}
                  {isFollowing ? 'Following' : 'Follow'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Banner Crop Modal */}
      <BannerCropModal
        isOpen={isBannerModalOpen}
        onClose={() => setIsBannerModalOpen(false)}
        onSave={handleBannerSave}
        currentBannerUrl={user.bannerImage}
      />
      {/* Avatar Crop Modal */}
      <AvatarCropModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        onSave={handleAvatarSave}
        currentAvatarUrl={user.avatar}
      />    </div>
  );
};

export default ProfileHeader;