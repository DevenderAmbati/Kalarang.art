import React from 'react';
import './PullToRefreshIndicator.css';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isTriggered: boolean;
  isRefreshing: boolean;
  isResetting?: boolean;
  threshold?: number;
}

const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isTriggered,
  isRefreshing,
  isResetting = false,
  threshold = 80,
}) => {
  const opacity = Math.min(pullDistance / 40, 1);
  const scale = Math.min(0.5 + (pullDistance / threshold) * 0.5, 1);
  const rotation = (pullDistance / threshold) * 360;

  return (
    <div 
      className="pull-refresh-indicator"
      style={{
        transform: `translateY(${Math.min(pullDistance - 20, 60)}px)`,
        opacity: opacity,
        transition: isResetting ? 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
      }}
    >
      <div
        className="pull-refresh-spinner"
        style={{
          transform: `scale(${scale}) rotate(${isRefreshing ? 0 : rotation}deg)`,
          transition: isResetting ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="rgba(47, 164, 169, 0.2)"
            strokeWidth="3"
          />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="#2FA4A9"
            strokeWidth="3"
            strokeDasharray="100"
            strokeDashoffset={isRefreshing ? "25" : `${100 - (pullDistance / threshold) * 75}`}
            strokeLinecap="round"
            className={isRefreshing ? 'spinning' : ''}
          />
          {/* Down arrow */}
          <g transform="translate(20, 20)">
            <path
              d="M0,-6 L0,6 M-4,2 L0,6 L4,2"
              stroke="#2FA4A9"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
