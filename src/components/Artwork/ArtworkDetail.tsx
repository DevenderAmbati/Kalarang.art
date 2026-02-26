import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ArtworkDetail.css';

export interface Artwork {
  id: number;
  title: string;
  artworkImage: string;
  thumbnails?: string[];
  category?: string;
  medium: string;
  size: string;
  createdOn?: string;
  price: number;
  description?: string;
  sold?: boolean;
}

export interface Artist {
  id: string;
  name: string;
  avatar: string;
  isFollowing?: boolean;
}

export interface ArtworkDetailProps {
  artwork: Artwork;
  artist: Artist;
  currentUserAvatar?: string;
  onShare?: (artworkId: number) => void;
  onSave?: (artworkId: number) => void;
  onReachOut?: (artistId: string) => void;
  onFollow?: (artistId: string) => void;
  onThumbnailClick?: (imageUrl: string) => void;
  isSaved?: boolean;
  onArtistClick?: (artistId: string) => void;
  currentUserId?: string;
}

const ArtworkDetail: React.FC<ArtworkDetailProps> = ({
  artwork,
  artist,
  currentUserAvatar,
  onShare,
  onSave,
  onReachOut,
  onFollow,
  onThumbnailClick,
  isSaved = false,
  onArtistClick,
  currentUserId,
}) => {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(artwork.artworkImage);

  const handleBack = () => {
    navigate(-1);
  };

  const handleIconClick = (
    e: React.MouseEvent,
    action?: () => void
  ) => {
    e.stopPropagation();
    if (action) {
      action();
    }
  };

  const handleArtistNameClick = () => {
    const isOwnProfile = artist.id === currentUserId;
    if (onArtistClick) {
      onArtistClick(artist.id);
    } else {
      window.location.href = isOwnProfile ? '/portfolio' : `/portfolio/${artist.id}`;
    }
  };

  const handleThumbnailClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    if (onThumbnailClick) {
      onThumbnailClick(imageUrl);
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Always include the main image first, then add any additional thumbnails
  const thumbnails = artwork.thumbnails?.length 
    ? [artwork.artworkImage, ...artwork.thumbnails.filter(thumb => thumb !== artwork.artworkImage)]
    : [artwork.artworkImage];

  return (
    <div className="artwork-detail">
      {/* Top Bar */}
      <div className="artwork-detail-top-bar">
        <div className="artist-info">
          <div className="artist-avatar-wrapper">
            <img 
              src={artist.avatar} 
              alt={artist.name}
              className="artist-avatar-detail"
            />
          </div>
          <span 
            className="artist-name-detail"
            onClick={handleArtistNameClick}
            style={{ cursor: 'pointer' }}
          >
            {artist.name}
          </span>
          {artist.id !== currentUserId && (
            <button
              className="follow-button"
              onClick={(e) => handleIconClick(e, () => onFollow?.(artist.id))}
            >
              {artist.isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        
        <button
          className="back-button-circular"
          onClick={handleBack}
          aria-label="Go back"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="artwork-detail-content">
        {/* Left Section - Image Gallery */}
        <div className="artwork-detail-left">
          <div className="artwork-main-image-wrapper">
            <img 
              src={selectedImage} 
              alt={artwork.title}
              className="artwork-main-image"
            />
            {artwork.sold && (
              <div className="artwork-detail-sold-badge">
                <span>SOLD</span>
              </div>
            )}
          </div>
          
          {thumbnails.length > 0 && (
            <div className="artwork-thumbnails">
              {thumbnails.slice(0, 4).map((thumb, index) => (
                <div 
                  key={index}
                  className={`thumbnail-wrapper ${selectedImage === thumb ? 'active' : ''}`}
                  onClick={() => handleThumbnailClick(thumb)}
                >
                  <img 
                    src={thumb} 
                    alt={`${artwork.title} view ${index + 1}`}
                    className="thumbnail-image"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Section - Details */}
        <div className="artwork-detail-right">
          <div className="artwork-detail-header">
            <h1 className="artwork-detail-title">{artwork.title}</h1>
            <div className="artwork-divider"></div>
          </div>

          {artwork.description && (
            <div className="artwork-description-detail">
              <p>{artwork.description}</p>
            </div>
          )}
          <div className="artwork-metadata">
            {artwork.category && (
              <div className="metadata-item">
                <span className="metadata-label">Category</span>
                <span className="metadata-value">{artwork.category}</span>
              </div>
            )}
            <div className="metadata-item">
              <span className="metadata-label">Medium</span>
              <span className="metadata-value">{artwork.medium}</span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Size</span>
              <span className="metadata-value">{artwork.size}</span>
            </div>
            {artwork.createdOn && (
              <div className="metadata-item">
                <span className="metadata-label">Created On</span>
                <span className="metadata-value">{new Date(artwork.createdOn).toLocaleDateString('en-US', { year: 'numeric', month: 'long'})}</span>
              </div>
            )}
            <div className="metadata-item">
              <span className="metadata-label">Price</span>
              <span className="metadata-value metadata-price">{formatPrice(artwork.price)}</span>
            </div>
          </div>


          {/* Action Area */}
          <div className="artwork-actions">
            <div className="action-icons">
              <button
                className={`action-icon-btn ${isSaved ? 'saved' : ''}`}
                onClick={(e) => handleIconClick(e, () => onSave?.(artwork.id))}
                aria-label="Save to Collection"
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill={isSaved ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span className="action-btn-text">Add to Favourites</span>
              </button>
              
              <button
                className="action-icon-btn"
                onClick={(e) => handleIconClick(e, () => onShare?.(artwork.id))}
                aria-label="Share"
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                <span className="action-btn-text">Share</span>
              </button>
            </div>

            <button
              className="reach-out-button"
              onClick={(e) => handleIconClick(e, () => onReachOut?.(artist.id))}
            >
              Reach Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtworkDetail;
