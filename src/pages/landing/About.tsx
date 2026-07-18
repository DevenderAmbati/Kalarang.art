import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdPalette, MdArrowForward, MdAutoAwesome } from 'react-icons/md';
import { HiOutlineSearch, HiSparkles } from 'react-icons/hi';
import { HiOutlineUserGroup } from 'react-icons/hi2';
import { IoIosColorPalette } from 'react-icons/io';
import { PiPaletteLight, PiPaintBrushHouseholdLight } from 'react-icons/pi';
import { FaPaintBrush, FaHeart, FaUserCircle } from 'react-icons/fa';
import { BiTargetLock } from 'react-icons/bi';
import { BsStars } from 'react-icons/bs';
import Header from '../../components/Layout/Header';
import Footer from '../../components/Layout/Footer';
import './landing.css';
import './about.css';
import '../auth/login.css';

const About: React.FC = () => {
  const navigate = useNavigate();
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const lastScrollY = useRef(0);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.05,
      rootMargin: "0px 0px -30px 0px",
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollY.current;
      lastScrollY.current = currentScrollY;

      entries.forEach((entry) => {
        const sectionId = entry.target.getAttribute("data-section");
        if (sectionId) {
          if (entry.isIntersecting) {
            if (currentScrollY === 0 || isScrollingDown) {
              setVisibleSections((prev) => {
                const newSet = new Set(Array.from(prev));
                newSet.add(sectionId);
                return newSet;
              });
            }
          } else if (!entry.isIntersecting && !isScrollingDown) {
            setVisibleSections((prev) => {
              const newSet = new Set(Array.from(prev));
              newSet.delete(sectionId);
              return newSet;
            });
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="login-left-section about-container landing-page">
      <Header />

      {/* Main content - starts below header, scrollable */}
      <div className="about-main-content landing-content">
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
        <div className="about-icon-bg-1">
          {IoIosColorPalette({})}
        </div>
        <div className="about-icon-bg-2">
          {PiPaletteLight({})}
        </div>
        <div className="about-icon-bg-3">
          {PiPaintBrushHouseholdLight({})}
        </div>
        <div className="about-icon-bg-4">
          {FaPaintBrush({})}
        </div>

        {/* Main content */}
        <div className="about-content-wrapper">
          {/* Hero Section */}
          <div
            className={`about-hero-section ${visibleSections.has('hero') ? 'animate-in' : ''}`}
            data-section="hero"
            ref={(el) => { sectionRefs.current.hero = el; }}
          >
            <div className="about-hero-sparkle-left">
              {HiSparkles({ size: 32 })}
            </div>
            <div className="about-hero-sparkle-right">
              {HiSparkles({ size: 32 })}
            </div>
            <h1 className="login-hero-headline-about home-hero-headline">
              <span className="gradient-text">About </span> BrushOwl
            </h1>
            <div className="about-hero-divider"></div>
            <p className="about-hero-subheading">
              Original paintings. Custom commissions. Real artists.
            </p>
            <p className="about-hero-intro">
              BrushOwl is where you go to find art that's made for you—<span className="highlight-text">not mass-produced,
                not algorithm-picked.</span> Browse original paintings, request custom portraits, and buy directly from
              talented artists who pour real craft into every piece.
            </p>
          </div>

          {/* Who We Are Section */}
          <section
            className={`about-section about-section-feature ${visibleSections.has('who') ? 'animate-in' : ''}`}
            data-section="who"
            ref={(el) => { sectionRefs.current.who = el; }}
          >
            <div className="about-section-icon-accent">
              {HiOutlineUserGroup({ size: 40 })}
            </div>
            <h2 className="about-section-heading">
              <span className="gradient-text">Art Made for You</span>
            </h2>
            <p className="about-section-text">
              BrushOwl is a <span className="highlight-text">buyer-first art marketplace</span> that connects you directly with skilled,
              independent artists. Whether you're looking for a one-of-a-kind original painting for your home,
              a heartfelt portrait as a gift, or a fully custom piece built around your vision—this is where you find it.
            </p>
          </section>

          {/* What We Do Section */}
          <section
            className={`about-section ${visibleSections.has('what') ? 'animate-in' : ''}`}
            data-section="what"
            ref={(el) => { sectionRefs.current.what = el; }}
          >
            <h2 className="gradient-text">What You Can Do Here</h2>
            <div className="about-cards-grid">
              <div className="about-card">
                <div className="about-card-icon">
                  {MdPalette({ size: 28 })}
                </div>
                <p className="about-card-text">
                  Browse and buy original paintings—handcrafted, one-of-a-kind pieces you won't find anywhere else
                </p>
              </div>
              <div className="about-card">
                <div className="about-card-icon">
                  {HiSparkles({ size: 28 })}
                </div>
                <p className="about-card-text">
                  Commission custom paintings built around your idea—portraits, pet art, gifts, home decor, and more
                </p>
              </div>
              <div className="about-card">
                <div className="about-card-icon">
                  {HiOutlineUserGroup({ size: 28 })}
                </div>
                <p className="about-card-text">
                  Connect directly with talented artists—no middlemen, no markups, just you and the person who made it
                </p>
              </div>
            </div>
          </section>

          {/* Why We Exist Section */}
          <section
            className={`about-section about-section-feature ${visibleSections.has('why') ? 'animate-in' : ''}`}
            data-section="why"
            ref={(el) => { sectionRefs.current.why = el; }}
          >
            <div className="about-section-icon-accent">
              {BiTargetLock({ size: 40 })}
            </div>
            <h2 className="about-section-heading">
              <span className="gradient-text">Why Buy on BrushOwl</span>
            </h2>
            <p className="about-section-text">
              Finding genuine, handmade art online is harder than it should be. Most platforms are flooded with prints and mass-produced work
              with no direct way to reach the artist. BrushOwl exists to change that—giving you a <span className="highlight-text">direct line to real artists</span>,
              so every purchase carries meaning and every commission feels personal.
            </p>
          </section>

          {/* Why We're Different Section */}
          <section
            className={`about-section about-section-feature ${visibleSections.has('different') ? 'animate-in' : ''}`}
            data-section="different"
            ref={(el) => { sectionRefs.current.different = el; }}
          >
            <div className="about-section-icon-accent">
              {HiSparkles({ size: 40 })}
            </div>
            <h2 className="about-section-heading">
              <span className="gradient-text">Portraits & Custom Work</span>
            </h2>
            <p className="about-section-text">
              Want a portrait of yourself, a loved one, or even your pet? Our artists specialize in bringing personal moments to life on canvas.
              Share your reference, describe your vision, and <span className="highlight-text">collaborate directly with the artist</span> through every step of the process.
              Custom commissions mean you get exactly what you imagined—painted by hand, made with care.
            </p>
          </section>

          {/* Our Vision Section */}
          <section
            className={`about-section about-section-feature about-vision-special ${visibleSections.has('vision') ? 'animate-in' : ''}`}
            data-section="vision"
            ref={(el) => { sectionRefs.current.vision = el; }}
          >
            <div className="about-section-icon-accent">
              {MdAutoAwesome({ size: 40 })}
            </div>
            <h2 className="about-section-heading">
              <span className="gradient-text">Our Promise to Buyers</span>
            </h2>
            <div className="about-vision-box">
              <div className="about-vision-icon">
                {FaHeart({ size: 24 })}
              </div>
              <p className="about-section-text">
                Every piece on BrushOwl is made by a real artist. When you buy here, your money goes directly to them—
                and you walk away with <span className="highlight-text">something truly original</span>, not a print off a factory line.
                Art worth owning. Artists worth supporting.
              </p>
            </div>
          </section>

          {/* CTA Section */}
          <section
            className={`about-cta-section ${visibleSections.has('cta') ? 'animate-in' : ''}`}
            data-section="cta"
            ref={(el) => { sectionRefs.current.cta = el; }}
          >
            <h2 className="about-cta-heading">Find Your Next Favorite Piece</h2>
            <p className="about-cta-description">
              Original paintings, custom portraits, and direct access to talented artists—all in one place.
              Start exploring and commission something made just for you.
            </p>
            <div className="about-cta-buttons">

              <button
                onClick={() => navigate('/signup')}
                className="login-button primary-cta about-cta-button"
              >
                <span>Sign Up Free</span>
                {MdArrowForward({ size: 14 })}
              </button>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default About;
