import React from 'react';
import './AboutTab.css';

interface AboutArtistProps {
  bio?: string;
  artStyle?: string[];
  philosophy?: string;
  achievements?: string[];
  exhibitions?: Array<{
    year: string;
    title: string;
  }>;
  education?: string[];
  commissions?: {
    status?: 'Open' | 'Closed';
    description: string;
    ctaText?: string;
  };
  links?: Array<{
    label: string;
    url: string;
    icon: string;
  }>;
}

// Icon components for achievements
const TrophyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zM8.5 8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM10 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" clipRule="evenodd" />
  </svg>
);

const StarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

// Icon components for links
const InstagramIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const PortfolioIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
  </svg>
);

const AboutArtist: React.FC<AboutArtistProps> = ({
  bio = "",
  artStyle = [],
  philosophy = "",
  achievements = [],
  exhibitions = [],
  education = [],
  commissions = {
    status: undefined,
    description: "",
    ctaText: "Get in Touch"
  },
  links = []
}) => {
  const getIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case 'instagram':
        return <InstagramIcon className={className} />;
      case 'portfolio':
        return <PortfolioIcon className={className} />;
      default:
        return <PortfolioIcon className={className} />;
    }
  };

  const getAchievementIcon = (index: number) => {
    return index % 2 === 0 ? 
      <TrophyIcon className="achievement-icon" /> : 
      <StarIcon className="achievement-icon" />;
  };

  return (
    <div className="about-artist">
      <section className="section">
        <h1 className="main-heading">About The Artist</h1>
        {bio ? (
          <p className="bio-text">{bio}</p>
        ) : (
          <p className="empty-field-message">No bio added yet.</p>
        )}
      </section>

      <section className="section">
        <h2 className="section-heading">Art Style & Mediums</h2>
        {artStyle && artStyle.length > 0 ? (
          <div className="art-style-tags">
            {artStyle.map((style, index) => (
              <span key={index} className="art-style-tag">
                {style}
              </span>
            ))}
          </div>
        ) : (
          <p className="empty-field-message">No art styles added yet.</p>
        )}
      </section>

      <section className="section">
        <h2 className="section-heading">Artistic Philosophy</h2>
        {philosophy ? (
          <p className="philosophy-text">{philosophy}</p>
        ) : (
          <p className="empty-field-message">No philosophy added yet.</p>
        )}
      </section>

      <section className="section">
        <h2 className="section-heading">Achievements</h2>
        {achievements && achievements.length > 0 ? (
          <ul className="achievements-list">
            {achievements.map((achievement, index) => (
              <li key={index} className="achievement-item">
                {getAchievementIcon(index)}
                <span className="achievement-text">{achievement}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-field-message">No achievements added yet.</p>
        )}
      </section>

      <section className="section">
        <h2 className="section-heading">Exhibitions / Recognition</h2>
        {exhibitions && exhibitions.length > 0 ? (
          <ul className="exhibitions-list">
            {exhibitions.map((exhibition, index) => (
              <li key={index} className="exhibition-item">
                <span className="exhibition-year">{exhibition.year}</span>
                <span className="exhibition-title">{exhibition.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-field-message">No exhibitions added yet.</p>
        )}
      </section>

      <section className="section">
        <h2 className="section-heading">Education</h2>
        {education && education.length > 0 ? (
          <ul className="education-list">
            {education.map((degree, index) => (
              <li key={index} className="education-item">
                {degree}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-field-message">No education added yet.</p>
        )}
      </section>

      {commissions.description && (
        <section className="section">
          <h2 className="section-heading">Commissions</h2>
          <div className="commissions-card">
            {commissions.status && (
              <div className="commission-header">
                <span className={`commission-status ${commissions.status.toLowerCase()}`}>
                  {commissions.status}
                </span>
              </div>
            )}
            <p className="commission-description">{commissions.description}</p>
            {commissions.status === 'Open' && (
              <button className="commission-cta">
                {commissions.ctaText || 'Get in Touch'}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-heading">Links</h2>
        {links && links.length > 0 ? (
          <ul className="links-list">
            {links.map((link, index) => (
              <li key={index} className="link-item">
                <a 
                  href={link.url} 
                  className="external-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${link.label} profile`}
                >
                  {getIcon(link.icon, "link-icon")}
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-field-message">No links added yet.</p>
        )}
      </section>
    </div>
  );
};

export default AboutArtist;