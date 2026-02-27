
import { useAuth } from "../../context/AuthContext";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MdLock, 
  MdRocketLaunch, 
  MdAttachMoney, 
  MdVisibility, 
  MdPerson, 
  MdBarChart,
  MdCollections,
  MdAutoAwesome,
  MdPublic,
  MdExplore,
  MdFavorite,
  MdChat,
  MdPeopleOutline
} from "react-icons/md";
import "./artistLanding.css";

// Capitalize first letter of each word in a name
const capitalizeName = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function ArtistLanding() {
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
            // On initial load or scrolling down, add section
            if (currentScrollY === 0 || isScrollingDown) {
              setVisibleSections((prev) => {
                const newSet = new Set(Array.from(prev));
                newSet.add(sectionId);
                return newSet;
              });
            }
          } else if (!entry.isIntersecting && !isScrollingDown) {
            // Remove section when scrolling up and leaving viewport
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

  const journeySteps = [
    {
      number: "1",
      title: "Add to Gallery",
      subtitle: "Private",
      description: "Upload your artwork to your private collection",
      icon: MdCollections,
    },
    {
      number: "2",
      title: "Refine Your Artwork",
      subtitle: "",
      description: "Edit details, add descriptions, and perfect your pieces",
      icon: MdAutoAwesome,
    },
    {
      number: "3",
      title: "Publish When Ready",
      subtitle: "",
      description: "Make your art visible to buyers when you're satisfied",
      icon: MdRocketLaunch,
    },
    {
      number: "4",
      title: "Reach Buyers Worldwide",
      subtitle: "",
      description: "Connect with collectors and art enthusiasts globally",
      icon: MdPublic,
    },
  ];

  const upcomingFeatures = [
    {
      title: "Private Artist Gallery",
      icon: MdLock,
      description:
        "Upload and store your artwork in a private gallery. Your work remains private until you decide to publish it. Perfect for building your collection at your own pace.",
    },
    {
      title: "Publish Artwork",
      icon: MdRocketLaunch,
      description:
        "When you're ready, publish individual pieces to make them visible in the Explore section. Control what buyers see and when they see it.",
    },
    {
      title: "Pricing & Artwork Details",
      icon: MdAttachMoney,
      description:
        "Set your own prices, add titles, descriptions, dimensions, and medium. Full control over how your work is presented to collectors.",
    },
    {
      title: "Explore Visibility",
      icon: MdVisibility,
      description:
        "Only published artwork appears in the Explore section for buyers. Your private gallery stays private until you choose to share.",
    },
    {
      title: "Artist Profile & Portfolio",
      icon: MdPerson,
      description:
        "Build a professional profile showcasing your published work, artist statement, and achievements. Your digital art portfolio.",
    },
    {
      title: "Analytics & Insights",
      icon: MdBarChart,
      description:
        "Track views, likes, and engagement on your published work. Understand your audience and refine your strategy (coming soon).",
    },
  ];

  const buyerFeatures = [
    {
      title: "Explore Original Artworks",
      icon: MdExplore,
      description: "Browse and discover unique pieces from talented artists worldwide.",
    },
    {
      title: "Save & Favorite Artworks",
      icon: MdFavorite,
      description: "Create collections of art you love and revisit them anytime.",
    },
    {
      title: "Chat with artists",
      icon: MdChat,
      description: "Reach out to artists directly via chat to learn about their work and the buying process.",
    },
    {
      title: "Follow & Support Artists",
      icon: MdPeopleOutline,
      description: "Connect with your favorite artists and stay updated on their work.",
    },
  ];

  return (
    <div className="artist-landing">
      {/* Hero Section */}
      <section 
        className={`hero-section ${visibleSections.has('hero') ? 'animate-in' : ''}`}
        data-section="hero"
        ref={(el) => { sectionRefs.current.hero = el; }}
      >
        <div className="hero-content">
          <h1 className="hero-title">
            Welcome to Kalarang, {appUser?.name ? capitalizeName(appUser.name) : "Artist"}
          </h1>
          <p className="hero-subtitle">
            Your space to create, refine, and publish original art.
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
          <h2 className="vision-title">Our Vision for Artists</h2>
          <p className="vision-text">
            Kalarang is built with {" "}<strong>artists at the heart. </strong> We believe the creative process deserves respect—free from trends, algorithms, virality, or the pressure to constantly create reels or chase formats. 
            Artists are not content creators, and their work is not meant to compete for attention.
          </p>
          <p className="vision-text">
            We have created a platform where artists have full control, transparent
            pricing, and direct connection with collectors who value original art.
          </p>
        </div>
      </section>

      {/* Upcoming Features Section */}
      <section 
        className={`features-section ${visibleSections.has('features') ? 'animate-in' : ''}`}
        data-section="features"
        ref={(el) => { sectionRefs.current.features = el; }}
      >
        <h2 className="section-title">What's there for Artists</h2>
        <div className="features-grid">
          {upcomingFeatures.map((feature, index) => (
            <div key={index} className="artist-feature-card">
              <div className="feature-icon">
                {feature.icon({ size: 48 })}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Artist Journey Section */}
      <section 
        className={`journey-section ${visibleSections.has('journey') ? 'animate-in' : ''}`}
        data-section="journey"
        ref={(el) => { sectionRefs.current.journey = el; }}
      >
        <h2 className="section-title">Your Artist Journey</h2>
        <p className="section-subtitle">
          A simple 4-step process designed around your creative workflow
        </p>
        <div className="journey-grid">
          {journeySteps.map((step) => (
            <div key={step.number} className="journey-card">
              <div className="journey-icon">
                {step.icon({ size: 48 })}
              </div>
              <div className="journey-number">Step {step.number}</div>
              <h3 className="journey-title">
                {step.title}
                {step.subtitle && (
                  <span className="journey-subtitle"> ({step.subtitle})</span>
                )}
              </h3>
              <p className="journey-description">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Buyer Features Section */}
      <section 
        className={`buyer-features-section ${visibleSections.has('buyer') ? 'animate-in' : ''}`}
        data-section="buyer"
        ref={(el) => { sectionRefs.current.buyer = el; }}
      >
        <div className="buyer-features-container">
          <h2 className="buyer-section-title">
            Artists are also buyers on Kalarang
          </h2>
          <p className="buyer-section-intro">
            Your artist account gives you access to the full Kalarang experience.
            Explore, discover, and collect art from fellow creators around the world.
          </p>
          <div className="buyer-features-grid">
            {buyerFeatures.map((feature, index) => (
              <div key={index} className="buyer-feature-item">
                <div className="buyer-feature-icon">
                  {feature.icon({ size: 32 })}
                </div>
                <div className="buyer-feature-content">
                  <h3 className="buyer-feature-title">{feature.title}</h3>
                  <p className="buyer-feature-desc">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="buyer-tagline">
            <strong>One account. Two experiences.</strong>
          </p>
        </div>
      </section>

   

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
