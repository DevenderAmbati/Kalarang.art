import React, { useRef, useEffect } from 'react';
import Lottie from 'lottie-react';
import './LoadingState.css';

interface LoadingStateProps {
  message?: string;
  fullHeight?: boolean;
  animation?: any;
  variant?: 'default' | 'cards' | 'content' | 'artwork-detail' | 'portfolio' | 'commissions';
  cardCount?: number;
  cardsLayout?: 'standard' | 'homefeed' | 'published' | 'customized';
}

const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Loading...', 
  fullHeight = false,
  animation,
  variant = 'default',
  cardCount = 6,
  cardsLayout = 'standard',
}) => {
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    if (!animation) return;
    const t = setTimeout(() => lottieRef.current?.setSpeed(2), 50);
    return () => clearTimeout(t);
  }, [animation]);

  return (
    <div className={`loading-state ${fullHeight ? 'loading-state-full' : ''}`}>
      {variant === 'cards' ? (
        <div className="loading-state-cards-wrapper">
          <div className={`loading-state-cards-grid loading-state-cards-grid-${cardsLayout}`} aria-hidden="true">
            {Array.from({ length: cardCount }).map((_, index) => (
              <div key={index} className={`loading-card-skeleton loading-card-skeleton-${cardsLayout}`}>
                <div className="loading-card-image shimmer" />
                <div className="loading-card-content">
                  <div className="loading-card-line loading-card-line-title shimmer" />
                  <div className="loading-card-line loading-card-line-subtitle shimmer" />
                </div>
              </div>
            ))}
          </div>
          <p className="loading-state-message">{message}</p>
        </div>
      ) : variant === 'artwork-detail' ? (
        <div className="loading-state-content-wrapper">
          <div className="loading-artwork-skeleton" aria-hidden="true">
            <div className="loading-artwork-topbar">
              <div className="loading-artwork-artist">
                <div className="loading-artwork-avatar shimmer" />
                <div className="loading-artwork-name shimmer" />
              </div>
              <div className="loading-artwork-back shimmer" />
            </div>
            <div className="loading-artwork-main">
              <div className="loading-artwork-left">
                <div className="loading-artwork-hero shimmer" />
                <div className="loading-artwork-thumbs">
                  <div className="loading-artwork-thumb shimmer" />
                  <div className="loading-artwork-thumb shimmer" />
                  <div className="loading-artwork-thumb shimmer" />
                </div>
              </div>
              <div className="loading-artwork-right">
                <div className="loading-content-line loading-content-line-lg shimmer" />
                <div className="loading-content-line loading-content-line-sm shimmer" />
                <div className="loading-artwork-meta shimmer" />
                <div className="loading-artwork-meta shimmer" />
                <div className="loading-artwork-meta shimmer" />
                <div className="loading-artwork-actions">
                  <div className="loading-artwork-action shimmer" />
                  <div className="loading-artwork-action shimmer" />
                  <div className="loading-artwork-buy shimmer" />
                </div>
              </div>
            </div>
          </div>
          <p className="loading-state-message">{message}</p>
        </div>
      ) : variant === 'portfolio' ? (
        <div className="loading-state-content-wrapper">
          <div className="loading-portfolio-skeleton" aria-hidden="true">
            <div className="loading-content-banner shimmer" />
            <div className="loading-portfolio-avatar shimmer" />
            <div className="loading-portfolio-name shimmer" />
            <div className="loading-portfolio-username shimmer" />
            <div className="loading-portfolio-stats">
              <div className="loading-portfolio-stat shimmer" />
              <div className="loading-portfolio-stat shimmer" />
              <div className="loading-portfolio-stat shimmer" />
            </div>
            <div className="loading-portfolio-actions">
              <div className="loading-portfolio-btn shimmer" />
              <div className="loading-portfolio-btn shimmer" />
            </div>
            <div className="loading-content-tabs">
              <div className="loading-content-tab shimmer" />
              <div className="loading-content-tab shimmer" />
              <div className="loading-content-tab shimmer" />
            </div>
            <div className="loading-content-grid">
              <div className="loading-content-card shimmer" />
              <div className="loading-content-card shimmer" />
              <div className="loading-content-card shimmer" />
            </div>
          </div>
          <p className="loading-state-message">{message}</p>
        </div>
      ) : variant === 'commissions' ? (
        <div className="loading-state-content-wrapper">
          <div className="loading-commissions-skeleton" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="loading-commission-card">
                <div className="loading-commission-main">
                  <div className="loading-commission-left">
                    <div className="loading-commission-title shimmer" />
                    <div className="loading-commission-desc shimmer" />
                    <div className="loading-commission-desc shimmer" />
                    <div className="loading-commission-meta-row">
                      <div className="loading-commission-meta shimmer" />
                      <div className="loading-commission-meta shimmer" />
                      <div className="loading-commission-meta shimmer" />
                    </div>
                  </div>
                  <div className="loading-commission-thumb shimmer" />
                </div>
                <div className="loading-commission-chip-row">
                  <div className="loading-commission-chip shimmer" />
                  <div className="loading-commission-chip shimmer" />
                  <div className="loading-commission-chip shimmer" />
                </div>
              </div>
            ))}
          </div>
          <p className="loading-state-message">{message}</p>
        </div>
      ) : variant === 'content' ? (
        <div className="loading-state-content-wrapper">
          <div className="loading-content-skeleton" aria-hidden="true">
            <div className="loading-content-banner shimmer" />
            <div className="loading-content-row">
              <div className="loading-content-avatar shimmer" />
              <div className="loading-content-meta">
                <div className="loading-content-line loading-content-line-lg shimmer" />
                <div className="loading-content-line loading-content-line-sm shimmer" />
              </div>
            </div>
            <div className="loading-content-tabs">
              <div className="loading-content-tab shimmer" />
              <div className="loading-content-tab shimmer" />
              <div className="loading-content-tab shimmer" />
            </div>
            <div className="loading-content-grid">
              <div className="loading-content-card shimmer" />
              <div className="loading-content-card shimmer" />
              <div className="loading-content-card shimmer" />
            </div>
          </div>
          <p className="loading-state-message">{message}</p>
        </div>
      ) : (
        <div className="loading-state-content">
          {animation ? (
            <div className="loading-state-animation">
              <Lottie 
                animationData={animation} 
                loop={true}
                lottieRef={lottieRef}
                style={{ width: '100%', maxWidth: '200px', height: 'auto' }}
              />
            </div>
          ) : (
            <div className="loading-spinner">
              <div className="spinner-circle"></div>
              <div className="spinner-circle-inner"></div>
            </div>
          )}
          <p className="loading-state-message">{message}</p>
          </div>
      )}
    </div>
  );
};

export default LoadingState;
