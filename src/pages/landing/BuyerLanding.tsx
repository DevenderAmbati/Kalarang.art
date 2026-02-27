import { useAuth } from "../../context/AuthContext";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MdExplore,
  MdFavorite,
  MdPerson,
  MdShoppingCart,
  MdChat,
  MdRocketLaunch,
  MdAutoAwesome,
  MdVerified,
  MdCollections,
  MdTrendingUp,
  MdPeopleOutline
} from "react-icons/md";
import "./buyerLanding.css";

// Capitalize first letter of each word in a name
const capitalizeName = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function BuyerLanding() {
  const { appUser } = useAuth();
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

  const handleEnterFeed = () => {
    navigate("/home");
  };

  const buyerFeatures = [
    {
      title: "Curated artwork discovery",
      icon: MdExplore,
      description:
        "Browse a carefully curated collection of original artworks from talented artists worldwide. Quality over quantity.",
    },
    // {
    //   title: "Save & favorite artworks",
    //   icon: MdFavorite,
    //   description:
    //     "Create your personal collection of favorites. Save artworks you love and revisit them anytime.",
    // },
    {
      title: "Discover artists & profiles",
      icon: MdPerson,
      description:
        "Learn about the artists behind the art. Explore artist profiles, their stories, and creative journeys.",
    },
    {
      title: "Follow & reach out to artists",
      icon: MdPeopleOutline,
      description:
        "Follow your favorite artists, stay updated on their new work, and can reachout to them directly.",
    },
    {
      title: "Chat with artists",
      icon: MdChat,
      description:
        "Start a conversation with artists directly. Ask about their work, process, or commissions.",
    },
  ];

  const journeySteps = [
    {
      number: "1",
      title: "Explore",
      description: "Browse curated artworks published by artists when they're ready",
      icon: MdExplore,
    },
    {
      number: "2",
      title: "Save",
      description: "Bookmark and favorite artworks that resonate with you",
      icon: MdFavorite,
    },
    {
      number: "3",
      title: "Learn about artist",
      description: "Discover the stories and profiles behind your favorite artworks",
      icon: MdPerson,
    },
    {
      number: "4",
      title: "Reach out",
      description: "Chat with artists to learn about their work and the buying process",
      icon: MdChat,
    },
  ];

  const artistFirstFeatures = [
    {
      title: "Artist-First Platform",
      icon: MdAutoAwesome,
      description: "Artists remain fully in control of their work, without pressure from algorithms, trends, or timelines.",
    },
    {
      title: "Quality-Focused Curation",
      icon: MdVerified,
      description: "We prioritize thoughtful curation over endless feeds. Discover art that matters.",
    },
    {
      title: "Direct Artist Connection",
      icon: MdCollections,
      description: "Support artists directly. Learn their stories, follow their journey, and connect meaningfully.",
    },
    {
      title: "Authentic Art Community",
      icon: MdTrendingUp,
      description: "Join a community that values original art, creative expression, and genuine artist support.",
    },
  ];

  return (
    <div className="buyer-landing">
      {/* Hero Section */}
      <section 
        className={`hero-section ${visibleSections.has('hero') ? 'animate-in' : ''}`}
        data-section="hero"
        ref={(el) => { sectionRefs.current.hero = el; }}
      >
        <div className="hero-content">
          <h1 className="hero-title">
            Welcome to Kalarang, {appUser?.name ? capitalizeName(appUser.name) : "Art Lover"}
          </h1>
          <p className="hero-subtitle">
            Your space to discover, explore, and collect original art.
          </p>
        </div>
      </section>

      {/* Vision Section */}
      <section 
        className={`vision-section ${visibleSections.has('vision') ? 'animate-in' : ''}`}
        data-section="vision"
        ref={(el) => { sectionRefs.current.vision = el; }}
      >
        <div className="vision-container">
          <h2 className="vision-title">Our Vision for Art Collectors</h2>
          <p className="vision-text">
            Kalarang is built for people who value art beyond trends and endless scrolling. We believe discovering 
            and collecting art should feel thoughtful and meaningful—not driven by algorithms, or popularity.
          </p>
          <p className="vision-text">
            We have created a space where collectors can explore original art, 
            connect directly with the artists behind the work, and invest in pieces that truly 
            resonate with them.
          </p>
        </div>
      </section>

      {/* Buyer Features Section */}
      <section 
        className={`features-section ${visibleSections.has('features') ? 'animate-in' : ''}`}
        data-section="features"
        ref={(el) => { sectionRefs.current.features = el; }}
      >
        <h2 className="section-title">What's there for Buyers</h2>
        <div className="features-grid">
          {buyerFeatures.map((feature, index) => (
            <div key={index} className="buyer-feature-card">
              <div className="feature-icon">
                {feature.icon({ size: 48 })}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Buyer Journey Section */}
      <section 
        className={`journey-section ${visibleSections.has('journey') ? 'animate-in' : ''}`}
        data-section="journey"
        ref={(el) => { sectionRefs.current.journey = el; }}
      >
        <h2 className="section-title">Your Buyer Journey</h2>
        <p className="section-subtitle">
          A simple and meaningful way to discover and collect original art
        </p>
        <div className="journey-grid">
          {journeySteps.map((step) => (
            <div key={step.number} className="journey-card">
              <div className="journey-icon">
                {step.icon({ size: 48 })}
              </div>
              <div className="journey-number">Step {step.number}</div>
              <h3 className="journey-title">{step.title}</h3>
              <p className="journey-description">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Artists & Community Section */}
      <section 
        className={`community-section ${visibleSections.has('community') ? 'animate-in' : ''}`}
        data-section="community"
        ref={(el) => { sectionRefs.current.community = el; }}
      >
        <div className="community-container">
          <h2 className="community-title">
            Why Kalarang is Different
          </h2>
          <p className="community-intro">
            Kalarang is built with artists at the heart. We prioritize creativity over trends and quality over quantity, 
            ensuring that art is discovered for its originality and intent—not popularity or performance metrics.
          </p>
          <div className="community-grid">
            {artistFirstFeatures.map((feature, index) => (
              <div key={index} className="community-feature-item">
                <div className="community-feature-icon">
                  {feature.icon({ size: 32 })}
                </div>
                <div className="community-feature-content">
                  <h3 className="community-feature-title">{feature.title}</h3>
                  <p className="community-feature-desc">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Early Access Notice */}

      {/* CTA Section */}
      <section 
        className={`cta-section ${visibleSections.has('cta') ? 'animate-in' : ''}`}
        data-section="cta"
        ref={(el) => { sectionRefs.current.cta = el; }}
      >
        <button className="cta-enter-button" onClick={handleEnterFeed}>
          {MdRocketLaunch({ size: 22 })}
          <span>Start Your Journey</span>
        </button>
      </section>
    </div>
  );
}
