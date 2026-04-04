import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CommissionReview } from '../../services/reviewService';
import './ReviewsModal.css';

interface ReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviews: CommissionReview[];
  avgRating: number;
}

const ReviewsModal: React.FC<ReviewsModalProps> = ({ isOpen, onClose, reviews, avgRating }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatDate = (ts: any) =>
    ts?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) ?? '';

  return createPortal(
    <div className="reviews-modal-overlay" onClick={handleOverlayClick}>
      <div className="reviews-modal-content">
        <div className="reviews-modal-header">
          <div className="reviews-modal-title-row">
            <h2>Reviews</h2>
            <div className="reviews-modal-summary">
              <span className="reviews-modal-avg">
                <span className="reviews-star">★</span>
                {avgRating.toFixed(1)}
                <span className="reviews-outof">/5</span>
              </span>
              <span className="reviews-modal-count">
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          </div>
          <button className="reviews-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="reviews-modal-body">
          {reviews.length === 0 ? (
            <div className="reviews-modal-empty">
              <p>No reviews yet</p>
            </div>
          ) : (
            <div className="reviews-list">
              {reviews.map((review) => (
                <div key={review.id} className="review-item">
                  <div className="review-item-header">
                    <img
                      src={review.buyerAvatar || '/artist.png'}
                      alt={review.buyerName}
                      className="review-avatar"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/artist.png'; }}
                    />
                    <div className="review-meta">
                      <p className="review-buyer-name">{review.buyerName}</p>
                      <p className="review-commission-title">{review.commissionTitle}</p>
                    </div>
                    <div className="review-rating-badge">
                      <span className="review-star">★</span>
                      <span className="review-rating-num">{review.rating}</span>
                      <span className="review-rating-out">/5</span>
                    </div>
                  </div>

                  <div className="review-stars-row">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={`review-star-icon ${s <= review.rating ? 'filled' : ''}`}>★</span>
                    ))}
                    {review.createdAt && (
                      <span className="review-date">{formatDate(review.createdAt)}</span>
                    )}
                  </div>

                  <p className="review-text">{review.reviewText}</p>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReviewsModal;
