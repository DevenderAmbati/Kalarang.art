import React, { useRef, useEffect } from 'react';
import Lottie from 'lottie-react';
import { useNavigate } from 'react-router-dom';
import './EmptyState.css';

interface EmptyStateProps {
  animation?: any;
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
  onAction?: () => void;
  icon?: string;
  /** Shows inline spinner and disables the action button while true */
  actionLoading?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  animation,
  title,
  description,
  actionLabel,
  actionPath,
  onAction,
  icon,
  actionLoading = false,
}) => {
  const navigate = useNavigate();
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    if (!animation) return;
    const t = setTimeout(() => lottieRef.current?.setSpeed(2), 50);
    return () => clearTimeout(t);
  }, [animation]);

  const handleAction = () => {
    if (actionLoading) return;
    if (onAction) {
      onAction();
    } else if (actionPath) {
      navigate(actionPath);
    }
  };

  return (
    <div className="empty-state">
      <div className="empty-state-content">
        {animation ? (
          <div className="empty-state-animation">
            <Lottie 
              animationData={animation} 
              loop={true}
              lottieRef={lottieRef}
              style={{ width: '100%', maxWidth: '300px', height: 'auto' }}
            />
          </div>
        ) : icon ? (
          <div className="empty-state-icon">{icon}</div>
        ) : null}
        
        <h2 className="empty-state-title">{title}</h2>
        <p className="empty-state-description">{description}</p>
        
        {actionLabel && (
          <button
            type="button"
            className={`empty-state-button${actionLoading ? ' empty-state-button--loading' : ''}`}
            onClick={handleAction}
            disabled={actionLoading}
          >
            {actionLoading && <span className="empty-state-button-spinner" aria-hidden />}
            <span className="empty-state-button-label">{actionLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
