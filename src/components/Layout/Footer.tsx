import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaInstagram } from 'react-icons/fa';

const Footer: React.FC = () => {
  const navigate = useNavigate();

  return (
    <footer className="home-footer" style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '1rem 3rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTop: '1px solid var(--primary-alpha-20)',
      backgroundColor: 'var(--color-bg-dark-surface)',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <img
          src="/test top.png"
          alt="Kalarang"
          className="home-footer-logo"
          style={{ height: '24px', width: 'auto' }}
        />
      </div>

      {/* Links */}
      <div className="home-footer-links" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <a href="#" style={{ color: 'var(--color-accent)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Privacy Policy
        </a>
        <a href="#" className="terms-link" style={{ color: 'var(--color-accent)', fontSize: '0.5rem', textDecoration: 'none' }}>
          Terms of Service
        </a>
        <a 
          href="https://www.instagram.com/kalarang.world" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            color: 'var(--color-accent)', 
            fontSize: '0.9rem', 
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.3s ease'
          }}
          title="Follow us on Instagram"
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {FaInstagram({ size: 18 })}
          <span>kalarang.world</span>
        </a>
        <a href="mailto:kalarang.team@gmail.com" style={{ color: 'var(--color-accent)', fontSize: '0.9rem', textDecoration: 'none' }}>
          kalarang.team@gmail.com
        </a>
      </div>
    </footer>
  );
};

export default Footer;
