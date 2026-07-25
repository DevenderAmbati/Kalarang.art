import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoIosColorPalette } from 'react-icons/io';
import { PiPaletteLight, PiPaintBrushHouseholdLight } from 'react-icons/pi';
import { FaPaintBrush } from 'react-icons/fa';
import { GrPaint } from 'react-icons/gr';
import { MdPalette, MdArrowForward } from 'react-icons/md';
import { HiOutlineSearch } from 'react-icons/hi';
import { HiOutlineUserGroup, HiOutlineChatBubbleLeftRight, HiOutlinePaintBrush, HiOutlineCheckBadge, HiOutlineHeart, HiOutlineShoppingBag, HiOutlineSparkles, HiTruck, HiOutlineBanknotes } from 'react-icons/hi2';
import Header from '../../components/Layout/Header';
import Footer from '../../components/Layout/Footer';
import { getPublishedArtworks } from '../../services/artworkService';
import '../auth/login.css';
import './landing.css';
import './home.css';

const RING_ITEMS = 12;

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [tapeImages, setTapeImages] = useState<string[]>([]);
  const [imagesReady, setImagesReady] = useState(false);
  const [exploding, setExploding] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const xStageRef = useRef<HTMLDivElement>(null);
  const xRotorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPublishedArtworks(30).then((artworks) => {
      const imgs = artworks
        .map((a) => a.images?.[0])
        .filter(Boolean) as string[];
      setTapeImages(imgs);

      // Preload all images before revealing the rings
      let loaded = 0;
      const total = imgs.length;
      if (total === 0) { setImagesReady(true); return; }
      imgs.forEach((src) => {
        const img = new Image();
        img.onload = img.onerror = () => {
          loaded++;
          if (loaded >= total) setImagesReady(true);
        };
        img.src = src;
      });
    }).catch(() => {});
  }, []);

  // Duplicate for seamless loop (mobile/tablet horizontal tape)
  const loopedImages = tapeImages.length > 0 ? [...tapeImages, ...tapeImages] : [];

  // Build the items for each ring; pick a different starting offset for ring 2.
  // Show placeholder slots until ALL images are preloaded, then fade in.
  const ringsLoading = !imagesReady;

  const ring1Images = useMemo(() => {
    if (!imagesReady || tapeImages.length === 0) return Array.from({ length: RING_ITEMS }, () => '');
    return Array.from({ length: RING_ITEMS }, (_, i) => tapeImages[i % tapeImages.length]);
  }, [tapeImages, imagesReady]);

  const ring2Images = useMemo(() => {
    if (!imagesReady || tapeImages.length === 0) return Array.from({ length: RING_ITEMS }, () => '');
    const off = Math.floor(tapeImages.length / 2);
    return Array.from({ length: RING_ITEMS }, (_, i) => tapeImages[(i + off) % tapeImages.length]);
  }, [tapeImages, imagesReady]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const key = entry.target.getAttribute('data-section');
          if (!key) return;
          setVisibleSections((prev) => {
            const next = new Set(prev);
            if (entry.isIntersecting) next.add(key);
            else next.delete(key);
            return next;
          });
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -30px 0px' }
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleStageMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const stage = xStageRef.current;
    const rotor = xRotorRef.current;
    if (!stage || !rotor) return;
    const rect = stage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 30;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
    rotor.style.transform = `rotateX(${y}deg) rotateY(${x}deg)`;
  };

  const handleStageLeave = () => {
    const rotor = xRotorRef.current;
    if (!rotor) return;
    rotor.style.transform = '';
  };

  return (
    <div className="login-left-section home-container landing-page">
      <Header />

      <p className="home-hero-eyebrow home-hero-eyebrow--mobile">we paint your ideas</p>

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


      {/* Main content — desktop: 2-col grid (left text / right 3D cube) */}
      <div className="login-left-content home-desktop-grid">
        <div className="home-content-left">
        <div className="login-brand-section">

          {/* Mobile/tablet: scrolling painting tape (hidden on desktop) */}
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
              <div className="login-logo-mark login-brand-stack">
                <img
                  src="/logobong.png"
                  alt="BrushOwl Logo"
                  className="login-logo-image login-brand-icon"
                />
                <div className="login-brand-text-stack">
                  <img
                    src="/text logo.png"
                    alt="BrushOwl"
                    className="login-brand-text"
                  />
                </div>
              </div>
            </div>
          )}

          <p className="home-hero-eyebrow home-hero-eyebrow--desktop">we paint your ideas</p>
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

        <div className="home-truck-road">
          <span className="home-truck-label home-truck-label-1">
            0% Commission Fee &nbsp;|&nbsp; 0 Platform Fee
          </span>
          <span className="home-truck-label home-truck-label-2">
            ✦ Free Delivery All Over India ✦
          </span>
          <span className="home-truck-icon">{HiTruck({ size: 40 })}</span>
        </div>

        {/* Call to Action */}
        <div className="home-cta-section">
          <h2 className="home-cta-heading">
            Join BrushOwl
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

        {/* Desktop only: two intersecting tilted painting rings (X shape) */}
        <div className="home-content-right" aria-hidden={ringsLoading}>
          <div
            className={`x-stage${ringsLoading ? ' is-loading' : ''}${exploding ? ' x-explode' : ''}`}
            ref={xStageRef}
            onMouseMove={handleStageMove}
            onMouseLeave={handleStageLeave}
            onClick={() => {
              if (exploding) return;
              setExploding(true);
              setTimeout(() => navigate('/explore'), 600);
            }}
            role="button"
            tabIndex={0}
            aria-label="Explore artworks"
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !exploding) {
                setExploding(true);
                setTimeout(() => navigate('/explore'), 600);
              }
            }}
          >
            <div className="x-rotor" ref={xRotorRef}>
              <div className="x-ring x-ring-1">
                <div className="x-ring-track x-ring-track-1">
                  {ring1Images.map((src, i) => {
                    const angle = (i / RING_ITEMS) * 360;
                    return (
                      <div
                        className="x-ring-item"
                        key={`r1-${i}`}
                        style={{ transform: `rotateZ(${angle}deg) translateY(calc(var(--ring-radius) * -1)) rotateX(90deg)` }}
                      >
                        {src ? <img src={src} alt="" className="x-ring-img" draggable={false} /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="x-ring x-ring-2">
                <div className="x-ring-track x-ring-track-2">
                  {ring2Images.map((src, i) => {
                    const angle = (i / RING_ITEMS) * 360;
                    return (
                      <div
                        className="x-ring-item"
                        key={`r2-${i}`}
                        style={{ transform: `rotateZ(${angle}deg) translateY(calc(var(--ring-radius) * -1)) rotateX(90deg)` }}
                      >
                        {src ? <img src={src} alt="" className="x-ring-img" draggable={false} /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <span className="home-3d-cube-hint">Tap to explore →</span>
          </div>
        </div>
      </div>
      </div>

      {/* How It Works — desktop only, two-column layout */}
      <section
        className={`home-hiw-section ${visibleSections.has('hiw-title') ? 'animate-in' : ''}`}
        data-section="hiw-title"
        ref={(el) => { sectionRefs.current['hiw-title'] = el; }}
      >
        <h2 className="home-hiw-title">How It Works?</h2>
        <div className="home-hiw-grid">

          {/* Left: Commission Work */}
          <div
            className={`home-hiw-col ${visibleSections.has('hiw-left') ? 'animate-in' : ''}`}
            data-section="hiw-left"
            ref={(el) => { sectionRefs.current['hiw-left'] = el; }}
          >
            <h3 className="home-hiw-col-heading">Commission Custom Art</h3>
            <ol className="home-hiw-steps">
              <li className="home-hiw-step">
                <span className="home-hiw-icon">{HiOutlineChatBubbleLeftRight({ size: 22 })}</span>
                <div>
                  <h4>Post a Commission Request</h4>
                  <p>Describe your vision, budget and timeline</p>
                </div>
              </li>
              <li className="home-hiw-step">
                <span className="home-hiw-icon">{HiOutlineSearch({ size: 22 })}</span>
                <div>
                  <h4>Select an Artist</h4>
                  <p>Choose from the pool of artists who have applied</p>
                </div>
              </li>
              <li className="home-hiw-step">
                <span className="home-hiw-icon">{HiOutlinePaintBrush({ size: 22 })}</span>
                <div>
                  <h4>Collaborate</h4>
                  <p>Work together on sketches, revisions and final details</p>
                </div>
              </li>
              <li className="home-hiw-step">
                <span className="home-hiw-icon">{HiOutlineCheckBadge({ size: 22 })}</span>
                <div>
                  <h4>Receive Your Art</h4>
                  <p>Get your one-of-a-kind artwork delivered to you</p>
                </div>
              </li>
            </ol>
          </div>

          {/* Right: Readymade Art */}
          <div
            className={`home-hiw-col ${visibleSections.has('hiw-right') ? 'animate-in' : ''}`}
            data-section="hiw-right"
            ref={(el) => { sectionRefs.current['hiw-right'] = el; }}
          >
            <h3 className="home-hiw-col-heading">Buy Readymade Art</h3>
            <ol className="home-hiw-steps">
              <li className="home-hiw-step">
                <span className="home-hiw-icon">{HiOutlineSparkles({ size: 22 })}</span>
                <div>
                  <h4>Discover Art</h4>
                  <p>Browse original artworks from talented artists</p>
                </div>
              </li>
              <li className="home-hiw-step">
                <span className="home-hiw-icon">{HiOutlineHeart({ size: 22 })}</span>
                <div>
                  <h4>Choose Your Piece</h4>
                  <p>Find the perfect artwork that speaks to you</p>
                </div>
              </li>
              <li className="home-hiw-step">
                <span className="home-hiw-icon">{HiOutlineShoppingBag({ size: 22 })}</span>
                <div>
                  <h4>Purchase Directly</h4>
                  <p>Buy directly from the artist — you can negotiate</p>
                </div>
              </li>
              <li className="home-hiw-step">
                <span className="home-hiw-icon">{HiOutlineCheckBadge({ size: 22 })}</span>
                <div>
                  <h4>Enjoy Your Art</h4>
                  <p>Receive your artwork and display it with pride</p>
                </div>
              </li>
            </ol>
          </div>

        </div>
      </section>

      {/* Mobile-only CTA — appears after How It Works */}
      <div
        className={`home-cta-bottom ${visibleSections.has('cta-bottom') ? 'animate-in' : ''}`}
        data-section="cta-bottom"
        ref={(el) => { sectionRefs.current['cta-bottom'] = el; }}
      >
        <h2 className="home-cta-heading">Join BrushOwl</h2>
        <button
          onClick={() => navigate('/signup')}
          className="login-button primary-cta home-cta-button home-cta-bottom-signup"
        >
          <span>Sign Up</span>
          {MdArrowForward({ size: 12 })}
        </button>
      </div>

      <Footer />
    </div>
  );
};

export default Home;
