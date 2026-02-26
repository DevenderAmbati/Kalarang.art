import React from 'react';
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
import '../auth/login.css';
import './home.css';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="login-left-section home-container">
      <Header />

      {/* Main content - centered */}
      <div className="home-main-content">
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
          <div className="login-logo-glow">
            <div className="login-logo-mark">
              <img
                src="/logo1.png"
                alt="Kalarang Logo"
                className="login-logo-image"
              />
            </div>
          </div>
          <h3 className="login-hero-headline home-hero-headline">
            <span className="gradient-text">Where Art </span> Meets Its People.
          </h3>
          <p className="login-hero-subtext">Discover and share original art with the world.</p>
        </div>

        <div className="login-feature-list">
          <div className="login-feature-item feature-card">
            <div className="login-feature-icon">
              {MdPalette({ size: 24 })}
            </div>
            <div>
              <h3 className="login-feature-title">Showcase Original Art</h3>
              <p className="login-feature-desc">For artists to share creations</p>
            </div>
          </div>
          <div className="login-feature-item feature-card">
            <div className="login-feature-icon">
              {HiOutlineSearch({ size: 24 })}
            </div>
            <div>
              <h3 className="login-feature-title">Discover Unique Works</h3>
              <p className="login-feature-desc">For buyers to explore art</p>
            </div>
          </div>
          <div className="login-feature-item feature-card">
            <div className="login-feature-icon">
              {HiOutlineUserGroup({ size: 24 })}
            </div>
            <div>
              <h3 className="login-feature-title">Global Creative Community</h3>
              <p className="login-feature-desc">Connect artists and art lovers</p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="home-cta-section">
          <h2 className="home-cta-heading">
            Join Kalarang
          </h2>
          <div>
          <button 
            onClick={() => navigate('/signup')}
            className="login-button primary-cta home-cta-button"
          >
            <span>Sign Up Free</span>
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