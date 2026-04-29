import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineSearch } from 'react-icons/hi';
import { MdArrowForward } from 'react-icons/md';
import { FaUserCircle } from 'react-icons/fa';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const [hideOnMobileScrollDown, setHideOnMobileScrollDown] = useState(false);
  const lastScrollY = useRef(0);
  const accumulated = useRef(0);

  useEffect(() => {
    const getScrollY = () =>
      window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    const onScroll = () => {
      if (window.innerWidth > 639) {
        setHideOnMobileScrollDown(false);
        return;
      }

      const currentY = getScrollY();
      const delta = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      if (currentY <= 10) {
        setHideOnMobileScrollDown(false);
        accumulated.current = 0;
        return;
      }

      if ((delta > 0 && accumulated.current < 0) || (delta < 0 && accumulated.current > 0)) {
        accumulated.current = 0;
      }
      accumulated.current += delta;

      if (accumulated.current > 6) {
        setHideOnMobileScrollDown(true);
        accumulated.current = 0;
      } else if (accumulated.current < -6) {
        setHideOnMobileScrollDown(false);
        accumulated.current = 0;
      }
    };

    lastScrollY.current = getScrollY();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, []);

  const handleExploreClick = () => {
    navigate('/explore');
  };

  return (
    <header className={`home-header ${hideOnMobileScrollDown ? 'home-header-mobile-hidden' : ''}`} style={{
      padding: '0.5rem 1rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
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
            className="home-nav-about"
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
              transition: 'all 0.3s ease',
              marginLeft: '-1.5rem'
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

          {/* Mobile-only Sign In — inline with Home/About */}
          <button
            className="home-nav-signin-mobile"
            onClick={() => navigate('/login')}
            style={{
              background: 'transparent',
              border: '1.2px solid var(--color-primary)',
              color: 'var(--color-primary)',
              fontSize: '0.58rem',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '0.18rem 0.55rem',
              borderRadius: '50px',
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap',
              marginLeft: 'auto',
            }}
          >
            Sign In
          </button>
        </div>
      </div>

      {/* Right Section: Founding Artists + Explore + Sign In */}
      <div className="home-header-right home-header-right-desktop" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
