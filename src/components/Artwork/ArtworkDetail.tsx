import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useImagePreviewBackNavigation } from '../../hooks/useImagePreviewBackNavigation';
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Touch gesture tracking
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const isTouchPanning = useRef(false);

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  // Handle back navigation for image preview
  useImagePreviewBackNavigation({
    isPreviewOpen,
    onClosePreview: handleClosePreview,
  });

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

  const handleImageClick = () => {
    setIsPreviewOpen(true);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClosePreview();
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch event handlers for mobile pinch-zoom and pan
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList): { x: number; y: number } => {
    if (touches.length === 1) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    if (e.touches.length === 2) {
      // Pinch-zoom start
      lastTouchDistance.current = getTouchDistance(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    } else if (e.touches.length === 1 && zoomLevel > 1) {
      // Pan start (only when zoomed in)
      isTouchPanning.current = true;
      lastTouchCenter.current = getTouchCenter(e.touches);
    }
  }, [zoomLevel]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // Pinch-zoom
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / lastTouchDistance.current;
      
      setZoomLevel((prev) => {
        const newZoom = Math.min(Math.max(prev * scale, 1), 4);
        if (newZoom === 1) {
          setPosition({ x: 0, y: 0 });
        }
        return newZoom;
      });
      
      lastTouchDistance.current = currentDistance;
    } else if (e.touches.length === 1 && isTouchPanning.current && lastTouchCenter.current && zoomLevel > 1) {
      // Pan
      const currentCenter = getTouchCenter(e.touches);
      const deltaX = currentCenter.x - lastTouchCenter.current.x;
      const deltaY = currentCenter.y - lastTouchCenter.current.y;
      
      setPosition((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      
      lastTouchCenter.current = currentCenter;
    }
  }, [zoomLevel]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    if (e.touches.length < 2) {
      lastTouchDistance.current = null;
    }
    if (e.touches.length === 0) {
      isTouchPanning.current = false;
      lastTouchCenter.current = null;
    }
  }, []);

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
          <div className="artwork-main-image-wrapper" onClick={handleImageClick}>
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

            {artist.id !== currentUserId && (
              <button
                className="reach-out-button"
                onClick={(e) => handleIconClick(e, () => onReachOut?.(artist.id))}
              >
                Reach Out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full Preview Modal */}
      {isPreviewOpen && (
        <div className="artwork-preview-overlay" onClick={handleOverlayClick}>
          <button className="preview-close-btn" onClick={handleClosePreview}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          {/* Zoom Controls */}
          <div className="preview-zoom-controls">
            <button 
              className="zoom-control-btn" 
              onClick={handleZoomIn}
              disabled={zoomLevel >= 4}
              title="Zoom In"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="M21 21l-4.35-4.35"></path>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            <span className="zoom-level-display">{Math.round(zoomLevel * 100)}%</span>
            <button 
              className="zoom-control-btn" 
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              title="Zoom Out"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="M21 21l-4.35-4.35"></path>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            {zoomLevel > 1 && (
              <button 
                className="zoom-control-btn zoom-reset" 
                onClick={handleResetZoom}
                title="Reset Zoom"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 4v6h6"></path>
                  <path d="M23 20v-6h-6"></path>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
              </button>
            )}
          </div>

          <div 
            className="artwork-preview-content"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
          >
            <img 
              src={selectedImage} 
              alt={artwork.title}
              className="artwork-preview-image"
              style={{
                transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease',
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtworkDetail;
