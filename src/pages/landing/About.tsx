import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdPalette, MdArrowForward, MdAutoAwesome } from 'react-icons/md';
import { HiOutlineSearch, HiSparkles } from 'react-icons/hi';
import { HiOutlineUserGroup } from 'react-icons/hi2';
import { IoIosColorPalette } from 'react-icons/io';
import { PiPaletteLight, PiPaintBrushHouseholdLight } from 'react-icons/pi';
import { FaPaintBrush, FaHeart } from 'react-icons/fa';
import { BiTargetLock } from 'react-icons/bi';
import Header from '../../components/Layout/Header';
import Footer from '../../components/Layout/Footer';
import './about.css';
import '../auth/login.css';

const About: React.FC = () => {
  const navigate = useNavigate();
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const lastScrollY = useRef(0);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -100px 0px",
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
    <div className="login-left-section about-container">
      <Header />

      {/* Main content - centered */}
      <div className="about-main-content">
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
              <span className="gradient-text">About </span> Kalarang
            </h1>
            <div className="about-hero-divider"></div>
            <p className="about-hero-subheading">
              Where creativity finds its people.
            </p>
            <p className="about-hero-intro">
              Kalarang is a creative platform built to help original work get the attention it deserves—<span className="highlight-text">without being influenced by
                trends, or algorithms.</span> We connect creators and art lovers in one place, making it easier to share,
              discover, and support creativity without barriers.
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
              <span className="gradient-text">Who We Are </span>
            </h2>
            <p className="about-section-text">
              We are a <span className="highlight-text">community-driven platform</span> created for people who believe creativity
              should be seen, valued, and supported. Kalarang brings together artists, creators,
              and art lovers to form a space where original work can thrive and reach the right audience.
            </p>
          </section>

          {/* What We Do Section */}
          <section
            className={`about-section ${visibleSections.has('what') ? 'animate-in' : ''}`}
            data-section="what"
            ref={(el) => { sectionRefs.current.what = el; }}
          >
            <h2 className="gradient-text">What We Do</h2>
            <div className="about-cards-grid">
              <div className="about-card">
                <div className="about-card-icon">
                  {MdPalette({ size: 28 })}
                </div>
                <p className="about-card-text">
                  Give creators a simple and beautiful space to showcase original work
                </p>
              </div>
              <div className="about-card">
                <div className="about-card-icon">
                  {HiOutlineSearch({ size: 28 })}
                </div>
                <p className="about-card-text">
                  Help buyers and art lovers discover unique pieces from independent creators
                </p>
              </div>
              <div className="about-card">
                <div className="about-card-icon">
                  {HiOutlineUserGroup({ size: 28 })}
                </div>
                <p className="about-card-text">
                  Build a trusted environment where creators and audiences can connect directly
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
              <span className="gradient-text">Why We Exist</span>
            </h2>
            <p className="about-section-text">
              Too much great creative work goes unnoticed—not because it lacks quality, but because it doesn’t fit trends or algorithms.
              We built Kalarang to change that. Our mission is to remove the gap between creators and people who appreciate creativity,
              so ideas, stories, and art can reach the audiences they deserve.
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
              <span className="gradient-text">Why We're Different</span>
            </h2>
            <p className="about-section-text">
              Kalarang is not driven by trends, algorithms, or virality.
              We don’t treat artists as content creators or push them to chase visibility through reel creation, formats, styles, or popularity.
              Instead, we focus on <span className="highlight-text">originality, intent, and meaningful creative work</span>—giving every artist a fair space to be discovered
              for what they create, not how well it performs.
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
              <span className="gradient-text">Our Vision </span>
            </h2>
            <div className="about-vision-box">
              <div className="about-vision-icon">
                {FaHeart({ size: 24 })}
              </div>
              <p className="about-section-text">
                To become a <span className="highlight-text">global home for original creativity</span>—where creators feel empowered
                to share their work and people can discover art that truly resonates with them.
              </p>
            </div>
          </section>

          {/* CTA Section */}
          <section
            className={`about-cta-section ${visibleSections.has('cta') ? 'animate-in' : ''}`}
            data-section="cta"
            ref={(el) => { sectionRefs.current.cta = el; }}
          >
            <h2 className="about-cta-heading">Be Part of the Creative Community</h2>
            <p className="about-cta-description">
              Whether you create or collect, Kalarang is a place for you. Join a growing
              community that celebrates originality, expression, and meaningful connection.
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
