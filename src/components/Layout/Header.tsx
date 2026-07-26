import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiOutlineSearch, HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import { MdArrowForward } from 'react-icons/md';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const path = location.pathname;
  const isHome = path === '/' || path === '';
  const isAbout = path === '/about';
  const isExplore = path === '/explore';
  const isSignUp = path === '/signup';

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleExploreClick = () => {
    navigate('/explore');
  };

  const go = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <header
      className={`home-header ${menuOpen ? 'home-header-menu-open' : ''}`}
      style={{
        padding: '0.5rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {/* Left Section: Logo and Navigation */}
      <div className="home-header-left" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        {/* Logo */}
        <button
          type="button"
          className="home-logo-section"
          onClick={() => go('/')}
          aria-label="BrushOwl home"
          style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <img
            src="/logobong.png"
            alt="BrushOwl"
            className="home-logo-icon"
            style={{ height: '36px', width: 'auto', display: 'block', objectFit: 'contain' }}
          />
        </button>

        {/* Desktop Navigation */}
        <div className="home-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button
            className={`home-nav-link${isHome ? ' is-active' : ''}`}
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
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              if (!isHome) e.currentTarget.style.background = 'var(--primary-alpha-10)';
            }}
            onMouseLeave={(e) => {
              if (!isHome) e.currentTarget.style.background = 'transparent';
            }}
          >
            Home
          </button>
          <button
            className={`home-nav-link home-nav-about${isAbout ? ' is-active' : ''}`}
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
              marginLeft: '-1.5rem',
            }}
            onMouseEnter={(e) => {
              if (!isAbout) e.currentTarget.style.background = 'var(--primary-alpha-10)';
            }}
            onMouseLeave={(e) => {
              if (!isAbout) e.currentTarget.style.background = 'transparent';
            }}
          >
            About
          </button>
        </div>
      </div>

      {/* Mobile: hamburger + dropdown menu */}
      <div className="home-mobile-menu" ref={menuRef}>
        <button
          type="button"
          className="home-menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? HiOutlineX({ size: 24 }) : HiOutlineMenu({ size: 24 })}
        </button>

        {menuOpen && (
          <nav className="home-mobile-menu-panel" aria-label="Mobile navigation">
            <button
              type="button"
              className={`home-mobile-menu-item${isHome ? ' is-active' : ''}`}
              aria-current={isHome ? 'page' : undefined}
              onClick={() => go('/')}
            >
              Home
            </button>
            <button
              type="button"
              className={`home-mobile-menu-item${isAbout ? ' is-active' : ''}`}
              aria-current={isAbout ? 'page' : undefined}
              onClick={() => go('/about')}
            >
              About
            </button>
            <button
              type="button"
              className={`home-mobile-menu-item${isExplore ? ' is-active' : ''}`}
              aria-current={isExplore ? 'page' : undefined}
              onClick={() => go('/explore')}
            >
              Explore
            </button>
            <button
              type="button"
              className={`home-mobile-menu-item home-mobile-menu-signin${isSignUp ? ' is-active' : ''}`}
              aria-current={isSignUp ? 'page' : undefined}
              onClick={() => go('/signup')}
            >
              Sign Up
            </button>
          </nav>
        )}
      </div>

      {/* Desktop Right Section: Explore + Sign In */}
      <div className="home-header-right home-header-right-desktop" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
            top: '1.9px',
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

        <button
          onClick={() => navigate('/signup')}
          className="login-button primary-cta home-signin-btn"
          style={{
            padding: '0.65rem 0.85rem',
            fontSize: '0.75rem',
            cursor: 'pointer',
            border: 'none',
            borderRadius: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <span>Sign Up</span>
          {MdArrowForward({ size: 15 })}
        </button>
      </div>
    </header>
  );
};

export default Header;
