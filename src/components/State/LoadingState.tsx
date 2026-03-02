import React, { useRef, useEffect } from 'react';
import Lottie from 'lottie-react';
import './LoadingState.css';

interface LoadingStateProps {
  message?: string;
  fullHeight?: boolean;
  animation?: any;
}

const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Loading...', 
  fullHeight = false,
  animation
}) => {
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    if (!animation) return;
    const t = setTimeout(() => lottieRef.current?.setSpeed(2), 50);
    return () => clearTimeout(t);
  }, [animation]);

  return (
    <div className={`loading-state ${fullHeight ? 'loading-state-full' : ''}`}>
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
    </div>
  );
};

export default LoadingState;
