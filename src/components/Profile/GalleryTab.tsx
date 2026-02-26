import React, { useState } from 'react';
import './GalleryTab.css';

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  aspectRatio?: number; // width/height ratio
  published?: boolean;
  isCommissioned?: boolean;
}

export interface GalleryTabProps {
  images: GalleryImage[];
  onImageClick?: (id: string) => void;
  isOwnProfile?: boolean;
}

const GalleryTab: React.FC<GalleryTabProps> = ({ images, onImageClick, isOwnProfile = true }) => {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = (imageId: string) => {
    setLoadedImages(prev => new Set(prev).add(imageId));
  };

  const handleImageError = (imageId: string) => {
    console.warn(`Failed to load image: ${imageId}`);
    setFailedImages(prev => new Set(prev).add(imageId));
  };

  const handleImageClick = (id: string) => {
    if (onImageClick) {
      onImageClick(id);
    }
  };

  if (images.length === 0) {
    return (
      <div className="gallery-tab-empty">
        <div className="gallery-tab-empty-content">
          <div className="gallery-tab-empty-icon">🎨</div>
          <h3 className="gallery-tab-empty-title">Your Canvas Awaits</h3>
          <p className="gallery-tab-empty-text">
            Transform this space into a stunning gallery! Upload your artwork to begin your creative journey.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-tab">
      <div className="gallery-tab-grid">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`gallery-tab-item ${loadedImages.has(image.id) ? 'loaded' : ''} ${failedImages.has(image.id) ? 'error' : ''} ${!isOwnProfile ? 'view-only' : ''}`}
            onClick={() => isOwnProfile && handleImageClick(image.id)}
            style={{
              animationDelay: `${index * 0.05}s`,
              cursor: isOwnProfile ? 'pointer' : 'default'
            }}
          >
            <div className="gallery-tab-image-wrapper">
              <img
                src={image.src}
                alt={image.alt}
                className="gallery-tab-image"
                loading="lazy"
                onLoad={() => handleImageLoad(image.id)}
                onError={() => handleImageError(image.id)}
                style={{
                  aspectRatio: image.aspectRatio || 'auto'
                }}
              />
              {isOwnProfile && image.published === false && (
                <div className="gallery-unpublished-badge">
                  <span>Unpublished</span>
                </div>
              )}
              {image.isCommissioned && (
                <div className="gallery-commission-badge">
                  <span>Commission Work</span>
                </div>
              )}
              {isOwnProfile && <div className="gallery-tab-image-overlay" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GalleryTab;