import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoIosColorPalette } from 'react-icons/io';
import { PiPaletteLight, PiPaintBrushHouseholdLight } from 'react-icons/pi';
import { FaPaintBrush } from 'react-icons/fa';
import { GrPaint } from 'react-icons/gr';
import { MdPalette, MdArrowForward } from 'react-icons/md';
import { HiOutlineSearch } from 'react-icons/hi';
import { HiOutlineUserGroup } from 'react-icons/hi2';
import Header from '../../components/Layout/Header';
import Footer from '../../components/Layout/Footer';
import { getPublishedArtworks } from '../../services/artworkService';
import '../auth/login.css';
import './landing.css';
import './home.css';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [tapeImages, setTapeImages] = useState<string[]>([]);

  useEffect(() => {
    getPublishedArtworks(30).then((artworks) => {
      const imgs = artworks
        .map((a) => a.images?.[0])
        .filter(Boolean) as string[];
      setTapeImages(imgs);
    }).catch(() => {});
  }, []);

  // Duplicate for seamless loop
  const loopedImages = tapeImages.length > 0 ? [...tapeImages, ...tapeImages] : [];

  return (
    <div className="login-left-section home-container landing-page">
      <Header />

      {/* Main content - starts below header, scrollable */}
      <div className="home-main-content landing-content">
        {/* Geometric pattern overlay */}
        <div className="login-pattern-overlay">
        <svg className="login-pattern-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="var(--primary-alpha-20)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Decorative geometric shapes */}
      <div className="login-geometric-shape-1"></div>
      <div className="login-geometric-shape-2"></div>
      <div className="login-geometric-shape-4"></div>

      {/* Decorative icon elements */}
      <div className="home-icon-bg-1">
        {IoIosColorPalette({})}
      </div>
      <div className="home-icon-bg-2">
        {PiPaletteLight({})}
      </div>
      <div className="home-icon-bg-3">
        {PiPaintBrushHouseholdLight({})}
      </div>
      <div className="home-icon-bg-4">
        {FaPaintBrush({})}
      </div>


      {/* Main content */}
      <div className="login-left-content">
        <div className="login-brand-section">

          {/* Desktop: scrolling painting tape replaces centre logo */}
          {loopedImages.length > 0 ? (
            <button
              className="home-centre-tape-btn"
              onClick={() => navigate('/explore')}
              aria-label="Explore artworks"
            >
              <div className="home-centre-tape-wrap">
                <div className="home-centre-tape-track">
                  {loopedImages.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="home-centre-tape-frame"
                      draggable={false}
                    />
                  ))}
                </div>
                <span className="home-centre-tape-hint">Tap to explore →</span>
              </div>
            </button>
          ) : (
            /* Fallback: original logo while images load (or on mobile) */
            <div className="login-logo-glow">
              <div className="login-logo-mark">
                <img
                  src="/logo1.png"
                  alt="Kalarang Logo"
                  className="login-logo-image"
                />
              </div>
            </div>
          )}

          <h3 className="login-hero-headline home-hero-headline">
            <span className="gradient-text">Get your paintings  </span> Customized.
          </h3>
          <p className="login-hero-subtext">✦ Portraits &nbsp;✦ Customized Art &nbsp;✦ Original Art</p>
        </div>

        <div className="login-feature-list">
          <div className="login-feature-item feature-card">
            <div className="login-feature-icon">
              {HiOutlineUserGroup({ size: 24 })}
            </div>
            <div>
              <h3 className="login-feature-title">Commission Custom Artwork</h3>
              <p className="login-feature-desc">Connect with artists for custom commissions</p>
            </div>
          </div>
          <div className="login-feature-item feature-card">
            <div className="login-feature-icon">
              {HiOutlineSearch({ size: 24 })}
            </div>
            <div>
              <h3 className="login-feature-title">Discover Unique Works</h3>
              <p className="login-feature-desc">For buyers to explore original art, buy directly from real artists</p>
            </div>
          </div>
          <div className="login-feature-item feature-card">
            <div className="login-feature-icon">
              {MdPalette({ size: 24 })}
            </div>
            <div>
              <h3 className="login-feature-title">Showcase Original Art</h3>
              <p className="login-feature-desc">For artists to share creations and reach buyers</p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="home-cta-section">
          <h2 className="home-cta-heading">
            Join Kalarang
          </h2>
          <div className="home-cta-buttons">
            <button
              onClick={() => navigate('/signup')}
              className="login-button primary-cta home-cta-button"
            >
              <span>Sign Up</span>
              {MdArrowForward({ size: 12 })}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="login-button home-cta-button home-cta-signin-btn"
            >
              <span>Sign In</span>
              {MdArrowForward({ size: 12 })}
            </button>
          </div>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  );
};

export default Home;
