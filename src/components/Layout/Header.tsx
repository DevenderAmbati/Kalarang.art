import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineSearch } from 'react-icons/hi';
import { MdArrowForward } from 'react-icons/md';
import { FaUserCircle } from 'react-icons/fa';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const handleExploreClick = () => {
    navigate('/explore');
  };

  return (
    <header className="home-header" style={{
      position: 'absolute',
      top: '0.5rem',
      left: '0.5rem',
      right: '2rem',
      padding: '0.5rem 0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 100
    }}>
      {/* Left Section: Logo and Navigation */}
      <div className="home-header-left" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        {/* Logo */}
        <div className="home-logo-section" style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          <img
            src="/logo top.png"
            alt="Kalarang Logo"
            className="home-logo-icon"
            style={{ height: '50px', width: 'auto' }}
          />
          <img
            src="/test top.png"
            alt="Kalarang Text"
            className="home-logo-text"
            style={{ height: '28px', width: 'auto', marginLeft: '-55px', position: 'relative', top: '5px' }}
          />
        </div>

        {/* Navigation */}
        <div className="home-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'relative', top: '5px', marginLeft: '-1.5rem' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              padding: '0.4rem 1rem',
              borderRadius: '50px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--primary-alpha-10)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Home
          </button>
          <button
            onClick={() => navigate('/about')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              padding: '0.4rem 1rem',
              borderRadius: '50px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--primary-alpha-10)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            About
          </button>
        </div>
      </div>

      {/* Right Section: Sign In Button */}
      <div className="home-header-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Explore Art Button */}
        <button
          onClick={handleExploreClick}
          className="home-explore-btn"
          style={{
            background: 'var(--color-primary)',
            border: 'none',
            color: 'white',
            fontSize: '0.75rem',
            fontWeight: '700',
            cursor: 'pointer',
            padding: '0.65rem 1rem',
            borderRadius: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            transition: 'all 0.3s ease',
            whiteSpace: 'nowrap',
            height: 'fit-content',
            position: 'relative',
            top: '1.9px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(47, 164, 169, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(47, 164, 169, 0.3)';
          }}
        >
          {HiOutlineSearch({ size: 16 })}
          <span className="home-explore-text">Explore Art</span>
        </button>

       
        

        {/* Sign In Button */}
        <button
          onClick={() => navigate('/login')}
          className="login-button primary-cta home-signin-btn"
          style={{
            padding: '0.65rem 0.85rem',
            fontSize: '0.75rem',
            cursor: 'pointer',
            border: 'none',
            borderRadius: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          <span>Sign In</span>
          {MdArrowForward({ size: 15 })}
        </button>
      </div>

    </header>
  );
};

export default Header;
