import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ArtworkCard.css';
import LazyImage from '../Common/LazyImage';

export interface ArtworkCardProps {
  id: number;
  artworkImage: string;
  artworkImages?: string[]; // Multiple images for carousel
  artistAvatar: string;
  artistName: string;
  artistId?: string;
  currentUserId?: string;
  title?: string;
  description: string;
  onCardClick?: (id: number) => void;
  onShare?: (id: number) => void;
  onSave?: (id: number) => void;
  isSaved?: boolean;
  sold?: boolean;
}

const ArtworkCard: React.FC<ArtworkCardProps> = ({
  id,
  artworkImage,
  artworkImages,
  artistAvatar,
  artistName,
  artistId,
  currentUserId,
  title,
  description,
  onCardClick,
  onShare,
  onSave,
  isSaved = false,
  sold = false,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Use artworkImages if provided, otherwise fallback to single artworkImage
  const images = artworkImages && artworkImages.length > 0 ? artworkImages : [artworkImage];
  const hasMultipleImages = images.length > 1;

  const navigate = useNavigate();
  const location = useLocation();

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(id);
    }
  };

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (artistId) {
      const isOwnProfile = artistId === currentUserId;
      if (!isOwnProfile) {
        sessionStorage.setItem('artworkSourceRoute', location.pathname);
      }
      navigate(isOwnProfile ? '/portfolio' : `/portfolio/${artistId}`);
    }
  };

  const handleIconClick = (
    e: React.MouseEvent,
    action?: (id: number) => void
  ) => {
    e.stopPropagation();
    if (action) {
      action(id);
    }
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    if (onSave) onSave(id);
    setTimeout(() => setIsAnimating(false), 400);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="artwork-card" onClick={handleCardClick}>
      <div className="artwork-card-header">
        <div className="artist-avatar">
          <LazyImage src={artistAvatar} alt={artistName} />
        </div>
        <div 
          className="artist-name" 
          onClick={handleArtistClick}
          style={{ cursor: artistId ? 'pointer' : 'default' }}
        >
          {artistName}
        </div>
      </div>

      <div className="artwork-image-container">
        <LazyImage src={images[currentImageIndex]} alt={description} className="artwork-image" />
        
        {hasMultipleImages && (
          <>
            <button 
              className="image-nav-button image-nav-left"
              onClick={handlePrevImage}
              aria-label="Previous image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            
            <button 
              className="image-nav-button image-nav-right"
              onClick={handleNextImage}
              aria-label="Next image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            
            <div className="image-indicators">
              {images.map((_, index) => (
                <span 
                  key={index} 
                  className={`image-indicator ${index === currentImageIndex ? 'active' : ''}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="artwork-description">
        {title && <div className="artwork-title">{title}</div>}
        <p>{description}</p>
      </div>

      <div className="artwork-actions">
        <button
          className={`action-icon ${isSaved ? 'active' : ''} ${isAnimating ? 'animating' : ''}`}
          onClick={handleSaveClick}
          aria-label="Save to favorites"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        <button
          className="action-icon"
          onClick={(e) => handleIconClick(e, onShare)}
          aria-label="Share"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ArtworkCard;
