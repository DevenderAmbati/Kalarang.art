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
}

const EmptyState: React.FC<EmptyStateProps> = ({
  animation,
  title,
  description,
  actionLabel,
  actionPath,
  onAction,
  icon,
}) => {
  const navigate = useNavigate();
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    if (!animation) return;
    const t = setTimeout(() => lottieRef.current?.setSpeed(2), 50);
    return () => clearTimeout(t);
  }, [animation]);

  const handleAction = () => {
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
            className="empty-state-button"
            onClick={handleAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
