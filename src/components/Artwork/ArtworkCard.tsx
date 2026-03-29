import React, { useState, useRef } from 'react';
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
  /** When set, shows a thumbs-up control (e.g. home feed). */
  onLike?: (id: number) => void;
  isLiked?: boolean;
  /** When set, shows a comment control (e.g. home feed). */
  onComment?: (id: number) => void;
  onArtistClick?: (id: number) => void;
  /** Discover feed: compact Follow / Following beside artist name (right). */
  showFollowButton?: boolean;
  isFollowingArtist?: boolean;
  onFollowClick?: (artistId: string) => void | Promise<void>;
  sold?: boolean;
  /** Read-only engagement row (e.g. artist “My Art” on home). Replaces like/save actions. */
  engagementStats?: {
    likes: number;
    comments: number;
    favorites: number;
  };
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
  onLike,
  isLiked = false,
  onComment,
  onArtistClick,
  showFollowButton = false,
  isFollowingArtist = false,
  onFollowClick,
  sold = false,
  engagementStats,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Use artworkImages if provided, otherwise fallback to single artworkImage
  const images = artworkImages && artworkImages.length > 0 ? artworkImages : [artworkImage];
  const hasMultipleImages = images.length > 1;

  const navigate = useNavigate();
  const location = useLocation();

  // Minimum swipe distance (in px) to trigger navigation
  const minSwipeDistance = 50;

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(id);
    }
  };

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onArtistClick) {
      onArtistClick(id);
    }
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

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLikeAnimating(true);
    if (onLike) onLike(id);
    setTimeout(() => setIsLikeAnimating(false), 400);
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onComment) onComment(id);
  };

  const [localFollowState, setLocalFollowState] = useState<boolean | null>(null);
  const followInFlight = useRef(false);

  const resolvedFollowing = localFollowState !== null ? localFollowState : isFollowingArtist;

  const handleFollowButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!artistId || !onFollowClick || followInFlight.current) return;
    followInFlight.current = true;
    const next = !resolvedFollowing;
    setLocalFollowState(next);
    Promise.resolve(onFollowClick(artistId)).finally(() => {
      followInFlight.current = false;
    });
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (hasMultipleImages) {
      if (isLeftSwipe) {
        // Swipe left - show next image
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      } else if (isRightSwipe) {
        // Swipe right - show previous image
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      }
    }
  };

  const showFollow =
    showFollowButton &&
    Boolean(artistId) &&
    artistId !== currentUserId &&
    !engagementStats;

  return (
    <div className="artwork-card" onClick={handleCardClick}>
      <div className="artwork-card-header">
        <div className="artist-avatar">
          <LazyImage src={artistAvatar} alt={artistName} />
        </div>
        <div className="artwork-card-header-text">
          <div 
            className="artist-name" 
            onClick={handleArtistClick}
            style={{ cursor: artistId ? 'pointer' : 'default' }}
          >
            {artistName}
          </div>
        </div>
        {showFollow && onFollowClick && (
          <button
            type="button"
            className={`artwork-card-follow-btn${resolvedFollowing ? ' is-following' : ''}`}
            onClick={handleFollowButtonClick}
            aria-pressed={resolvedFollowing}
            aria-label={resolvedFollowing ? 'Unfollow' : 'Follow'}
          >
            <span className="artwork-card-follow-btn-label">
              {resolvedFollowing ? 'Following' : 'Follow'}
            </span>
          </button>
        )}
      </div>

      <div 
        className="artwork-image-container"
        onTouchStart={hasMultipleImages ? onTouchStart : undefined}
        onTouchMove={hasMultipleImages ? onTouchMove : undefined}
        onTouchEnd={hasMultipleImages ? onTouchEnd : undefined}
      >
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

      <div
        className={`artwork-actions ${
          engagementStats
            ? 'artwork-actions-feed artwork-actions-engagement'
            : onLike || onComment
              ? 'artwork-actions-feed'
              : ''
        }`}
      >
        {engagementStats ? (
          <>
            <div className="artwork-actions-left artwork-actions-left--stats">
              <span className="artwork-stat" title="Likes">
                <span className="artwork-stat-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                  </svg>
                </span>
                <span className="artwork-stat-num">{engagementStats.likes}</span>
              </span>
              <button
                type="button"
                className="artwork-stat artwork-stat--clickable"
                onClick={handleCommentClick}
                title="Comments"
                aria-label={`Comments, ${engagementStats.comments}`}
              >
                <span className="artwork-stat-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </span>
                <span className="artwork-stat-num">{engagementStats.comments}</span>
              </button>
              {onShare && (
                <button
                  type="button"
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
              )}
            </div>
            <div className="artwork-actions-right">
              <span className="artwork-stat" title="Saved to favourites">
                <span className="artwork-stat-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </span>
                <span className="artwork-stat-num">{engagementStats.favorites}</span>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="artwork-actions-left">
              {onLike && (
                <button
                  type="button"
                  className={`action-icon action-like ${isLiked ? 'active' : ''} ${isLikeAnimating ? 'animating' : ''}`}
                  onClick={handleLikeClick}
                  aria-label={isLiked ? 'Unlike' : 'Like'}
                  aria-pressed={isLiked}
                >
                  <span className="action-like-icon" aria-hidden>
                    {isLiked ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                      </svg>
                    )}
                  </span>
                </button>
              )}

              {onComment && (
                <button
                  type="button"
                  className="action-icon action-comment"
                  onClick={handleCommentClick}
                  aria-label="Comments"
                >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                </button>
              )}

              {onShare && (
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
              )}
            </div>

            <div className="artwork-actions-right">
              <button
                className={`action-icon ${isSaved ? 'active' : ''} ${isAnimating ? 'animating' : ''}`}
                onClick={handleSaveClick}
                aria-label="Save to favorites"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(ArtworkCard);
