import React from 'react';
import { createPortal } from 'react-dom';
import Lottie from 'lottie-react';
import laptopDrawing from '../../animations/Laptop-Drawing 1.json';

interface FullScreenLoaderProps {
  isVisible: boolean;
  message?: string;
}

const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({
  isVisible,
  message = 'Processing...',
}) => {
  if (!isVisible) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(162, 201, 201, 0.85)',
        zIndex: 10000,
        backdropFilter: 'blur(6px)',
      }}
    >
      <Lottie
        animationData={laptopDrawing}
        loop={true}
        style={{ width: '350px', height: '350px' }}
      />
      <p
        style={{
          marginTop: '1.5rem',
          fontSize: '1.3rem',
          color: '#1E4FA3',
          fontWeight: 500,
          textAlign: 'center',
          padding: '0 2rem',
        }}
      >
        {message}
      </p>
    </div>,
    document.body
  );
};

export default FullScreenLoader;
