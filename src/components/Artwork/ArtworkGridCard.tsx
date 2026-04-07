import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ArtworkGridCard.css';
import { Artwork } from './ArtworkGrid';
import LazyImage from '../Common/LazyImage';

export interface ArtworkGridCardProps {
  artwork: Artwork;
  onArtworkClick: (id: string) => void;
  onArtistClick?: (artistId: string) => void;
  isOwner?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onMarkAsSold?: (id: string) => void;
  onSave?: (id: string) => void;
  isSaved?: boolean;
  onAddToStory?: (id: string) => void;
  hasStory?: boolean;
  currentUserId?: string;
  viewType?: 'homefeed' | 'discover' | 'published' | 'favourites';
  onCommentClick?: (id: string) => void;
  onShare?: (id: string) => void;
  onLike?: (id: string) => void;
  isLiked?: boolean;
}

const ArtworkGridCard: React.FC<ArtworkGridCardProps> = ({ 
  artwork, 
  onArtworkClick,
  onArtistClick,
  isOwner = false,
  onEdit,
  onDelete,
  onMarkAsSold,
  onSave,
  isSaved = false,
  onAddToStory,
  hasStory = false,
  currentUserId,
  viewType,
  onCommentClick,
  onShare,
  onLike,
  isLiked = false
}) => {
  const [saved, setSaved] = useState(isSaved);
  const [liked, setLiked] = useState(isLiked);
  const [showMenu, setShowMenu] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync internal state with prop changes (e.g., when favorites change from other pages)
  useEffect(() => {
    setSaved(isSaved);
  }, [isSaved]);

  useEffect(() => {
    setLiked(isLiked);
  }, [isLiked]);

  const navigate = useNavigate();
  const location = useLocation();

  const handleCardClick = () => {
    onArtworkClick(artwork.id);
  };

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onArtistClick) {
      onArtistClick(artwork.artistId || '');
      return;
    }
    if (artwork.artistId) {
      const isOwnProfile = artwork.artistId === currentUserId;
      if (!isOwnProfile) {
        sessionStorage.setItem('artworkSourceRoute', location.pathname);
      }
      navigate(isOwnProfile ? '/portfolio' : `/portfolio/${artwork.artistId}`);
    }
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    setSaved(!saved);
    if (onSave) onSave(artwork.id);
    
    // Reset animation state after animation completes
    setTimeout(() => setIsAnimating(false), 500);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Determine if we should show dropdown upwards or downwards
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // Account for BottomNav (~65px) on mobile devices
      const bottomNavHeight = window.innerWidth <= 639 ? 75 : 0;
      const spaceBelow = viewportHeight - rect.bottom - bottomNavHeight;
      const spaceAbove = rect.top;
      
      // If less than 200px space below (after accounting for BottomNav) and more space above, show upwards
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        setDropdownDirection('up');
      } else {
        setDropdownDirection('down');
      }
    }
    
    setShowMenu(!showMenu);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onEdit) onEdit(artwork.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onDelete) onDelete(artwork.id);
  };

  const handleMarkAsSold = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onMarkAsSold) onMarkAsSold(artwork.id);
  };

  const handleAddToStory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onAddToStory) onAddToStory(artwork.id);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString('en-IN')}`;
  };

  const showStats = viewType === 'published' && isOwner;
  const showInteractive = viewType === 'published' && !isOwner;
  const noHover = viewType === 'published' && isOwner;

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCommentClick) onCommentClick(artwork.id);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShare) onShare(artwork.id);
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLikeAnimating(true);
    setLiked(!liked);
    if (onLike) onLike(artwork.id);
    setTimeout(() => setIsLikeAnimating(false), 500);
  };

  return (
    <div className={`artwork-grid-card ${showMenu ? 'menu-open' : ''} ${noHover ? 'no-hover' : ''} ${showInteractive ? 'interactive-hover' : ''}`} onClick={handleCardClick} ref={cardRef}>
      <div className="artwork-grid-card-image-container">
        <LazyImage 
          src={artwork.artworkImage} 
          alt={artwork.title} 
          className="artwork-grid-card-image" 
        />
        
        <div className="artwork-grid-card-overlay">
          <h3 className="artwork-grid-card-title">{artwork.title}</h3>
        </div>
        
        {artwork.sold && (
          <div className="artwork-sold-badge">
            <span>SOLD</span>
          </div>
        )}
        
        {!isOwner && artwork.artistId !== currentUserId && (
          <button
            className={`artwork-grid-card-heart ${saved ? 'liked' : ''} ${isAnimating ? 'animating' : ''}`}
            onClick={handleSaveClick}
            aria-label="Save to favorites"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}
        
        {showStats && (
          <div className="artwork-grid-card-favorites-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span className="favorites-count">{artwork.favorites || 0}</span>
          </div>
        )}
      </div>

      <div className="artwork-grid-card-content">
        {showInteractive ? (
          <div className="artwork-grid-card-actions artwork-actions-interactive">
            <div className="artwork-actions-left">
              {onLike && (
                <button
                  type="button"
                  className={`action-icon action-like ${liked ? 'active' : ''} ${isLikeAnimating ? 'animating' : ''}`}
                  onClick={handleLikeClick}
                  aria-label={liked ? 'Unlike' : 'Like'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                  </svg>
                </button>
              )}
              {onCommentClick && (
                <button
                  type="button"
                  className="action-icon"
                  onClick={handleCommentClick}
                  aria-label="Comment"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </button>
              )}
              {onShare && (
                <button
                  type="button"
                  className="action-icon"
                  onClick={handleShareClick}
                  aria-label="Share"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              <div className="artwork-grid-card-price">
                {formatPrice(artwork.price)}
              </div>
            </div>
          </div>
        ) : !showStats ? (
          <div className="artwork-grid-card-artist">
            <div className="artwork-grid-card-avatar">
              <LazyImage src={artwork.artistAvatar} alt={artwork.artistName} />
            </div>
            <span 
              className="artwork-grid-card-artist-name"
              onClick={handleArtistClick}
              style={{ cursor: artwork.artistId ? 'pointer' : 'default' }}
            >
              {artwork.artistName}
            </span>
            <div className="artwork-grid-card-price-container">
              <div className="artwork-grid-card-price">
                {formatPrice(artwork.price)}
              </div>
            </div>
          </div>
        ) : (
          <div className="artwork-grid-card-actions artwork-actions-engagement">
            <div className="artwork-actions-left artwork-actions-left--stats">
              <span className="artwork-stat" title="Likes">
                <span className="artwork-stat-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                  </svg>
                </span>
                <span className="artwork-stat-num">{artwork.likes || 0}</span>
              </span>
              <button
                type="button"
                className="artwork-stat artwork-stat--clickable"
                onClick={handleCommentClick}
                title="Comments"
                aria-label={`Comments, ${artwork.comments || 0}`}
              >
                <span className="artwork-stat-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </span>
                <span className="artwork-stat-num">{artwork.comments || 0}</span>
              </button>
              {onShare && (
                <button
                  type="button"
                  className="action-icon"
                  onClick={handleShareClick}
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
              <div className="artwork-grid-card-price">
                {formatPrice(artwork.price)}
              </div>
              {isOwner && (
                <div className="artwork-grid-card-menu-wrapper" ref={menuRef}>
                  <button
                    className="artwork-grid-card-menu-button"
                    onClick={handleMenuClick}
                    aria-label="More options"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>
                  {showMenu && (
                    <div className={`artwork-grid-card-dropdown ${dropdownDirection === 'up' ? 'dropdown-up' : ''}`}>
                      <button className="dropdown-item" onClick={handleEdit}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit Artwork
                      </button>
                      <button className="dropdown-item" onClick={handleDelete}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Delete Artwork
                      </button>
                      <button className="dropdown-item" onClick={handleMarkAsSold}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        {artwork.sold ? 'Remove Sold' : 'Mark as Sold'}
                      </button>
                      {!hasStory && onAddToStory && (
                        <button className="dropdown-item" onClick={handleAddToStory}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                          </svg>
                          Add to Story
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtworkGridCard;
