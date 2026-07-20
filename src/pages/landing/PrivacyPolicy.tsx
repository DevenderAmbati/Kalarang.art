import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import './legal.css';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="legal-container">
      {/* Main content */}
      <div className="legal-main-content">
        {/* Content wrapper */}
        <div className="legal-content-wrapper">
          {/* Back button */}
          <button className="legal-back-button" onClick={() => navigate(-1)} aria-label="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Header */}
          <div className="legal-header">
            <div className="legal-icon">
              {IoShieldCheckmarkOutline({ size: 48 })}
            </div>
            <h1 className="legal-title">
              <span className="gradient-text">Privacy Policy</span>
            </h1>
            <p className="legal-subtitle">MVP Version – BrushOwl</p>
            <p className="legal-last-updated">Last Updated: March 3, 2026</p>
          </div>

          {/* Content */}
          <div className="legal-content">
            <div className="legal-intro">
              <p>Your privacy matters to us.</p>
              <p>This Privacy Policy explains how BrushOwl collects and uses information.</p>
            </div>

            <section className="legal-section">
              <h2>1. Information We Collect</h2>
              <p>When you create a BrushOwl account, we collect essential information including your full name, email address, and account type (Artist or Buyer). This information is necessary to provide you with our core services.</p>
              <p>We also collect profile details you choose to add, such as your bio, profile picture, and artwork portfolios. Messages sent through our platform are stored to enable communication between users.</p>
              <p>Additionally, we automatically collect technical information such as your IP address, device type, browser information, and basic analytics data. This helps us understand how users interact with our platform and improve our services.</p>
            </section>

            <section className="legal-section">
              <h2>2. How We Use Your Information</h2>
              <p>We use your information to create and manage your account, enabling you to access all features of BrushOwl. Your data allows us to facilitate messaging between artists and buyers, creating meaningful connections.</p>
              <p>Your artwork and profile information are displayed on the platform to help you reach your intended audience. We analyze usage patterns to continuously improve our platform and user experience.</p>
              <p>We send important account-related notifications, such as security alerts, feature updates, and platform announcements.</p>
              <p className="legal-highlight">We respect your privacy and do not sell your personal data to third parties.</p>
            </section>

            <section className="legal-section">
              <h2>3. Messaging</h2>
              <p>Messages sent between users are stored on our system to enable communication.</p>
              <p>We do not monitor private messages unless required for safety, legal reasons, or abuse investigation.</p>
            </section>

            <section className="legal-section">
              <h2>4. Third-Party Services</h2>
              <p>To operate BrushOwl effectively, we partner with trusted third-party service providers. These include hosting providers who store our data securely, authentication services like Firebase that manage user logins, and analytics tools that help us understand platform usage.</p>
              <p>These service providers may process limited data as necessary to deliver their services. We carefully select partners who maintain high security and privacy standards.</p>
              <p>We ensure that these third parties only have access to the minimum data required to perform their specific functions.</p>
            </section>

            <section className="legal-section">
              <h2>5. Data Security</h2>
              <p>We take reasonable steps to protect your information.</p>
              <p>However, no online platform can guarantee complete security.</p>
            </section>

            <section className="legal-section">
              <h2>6. Data Retention</h2>
              <p>We retain your data as long as your account is active.</p>
              <p>You may request account deletion at any time.</p>
            </section>

            <section className="legal-section">
              <h2>7. Children's Privacy</h2>
              <p>BrushOwl is not intended for children under 13 years old.</p>
            </section>

            <section className="legal-section">
              <h2>8. Changes to This Policy</h2>
              <p>We may update this Privacy Policy. Continued use of the platform means you accept the changes.</p>
            </section>

            <div className="legal-footer-note">
              <p>For questions regarding this Privacy Policy, contact:</p>
              <a href="mailto:hello@brushowl.com" className="legal-contact-link">
                hello@brushowl.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
