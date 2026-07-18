import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoDocumentTextOutline } from 'react-icons/io5';
import './legal.css';

const TermsOfService: React.FC = () => {
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
              {IoDocumentTextOutline({ size: 48 })}
            </div>
            <h1 className="legal-title">
              <span className="gradient-text">Terms of Service</span>
            </h1>
            <p className="legal-subtitle">MVP Version – BrushOwl</p>
            <p className="legal-last-updated">Last Updated: March 18, 2026</p>
          </div>

          {/* Content */}
          <div className="legal-content">
            <div className="legal-intro">
              <p>Welcome to BrushOwl.</p>
              <p>By creating an account or using BrushOwl, you agree to the following Terms of Service.</p>
            </div>

            <section className="legal-section">
              <h2>1. About BrushOwl</h2>
              <p>BrushOwl is an online platform designed to connect artists and art enthusiasts. Our platform enables artists to upload and publish their original artwork, creating a vibrant showcase of their creative work.</p>
              <p>For buyers and art lovers, BrushOwl provides a space to discover unique artwork and establish direct communication with artists through our integrated chat feature.</p>
              <p className="legal-highlight">
                Important: BrushOwl only provides a platform for discovery and communication. We do not process payments, handle shipping, or participate in transactions between artists and buyers.
              </p>
            </section>

            <section className="legal-section">
              <h2>2. Account Registration</h2>
              <p>To create and use a BrushOwl account, you must be at least 18 years old or have obtained parental consent to use our platform.</p>
              <p>During registration, you agree to provide accurate and complete information. It is your responsibility to keep your login credentials secure and confidential.</p>
              <p>Please note that you are fully responsible for all activities that occur under your account. If you suspect unauthorized access, contact us immediately.</p>
            </section>

            <section className="legal-section">
              <h2>3. Artist Responsibilities</h2>
              <p>As an artist on BrushOwl, you must upload only artwork that you own and have the legal rights to share. All content you post should be your original creation or properly licensed work.</p>
              <p>You retain full ownership of your artwork. However, by uploading artwork to our platform, you grant BrushOwl a non-exclusive license to display, feature, and promote your work on the platform and in BrushOwl&apos;s marketing materials.</p>
              <p>This may include showcasing artworks on the BrushOwl website, social media platforms, promotional campaigns, advertisements, and community highlights. Whenever reasonably possible, we will credit the artist when their work is featured.</p>
              <p>You are fully responsible for all aspects of transactions including pricing, negotiation, payment collection, packaging, and shipping. Any transaction happens directly between you and the buyer.</p>
              <p>Please understand that BrushOwl does not verify authenticity, pricing, or delivery arrangements. These are solely your responsibility as the artist.</p>
            </section>

            <section className="legal-section">
              <h2>4. Buyer Responsibilities</h2>
              <p>As a buyer on BrushOwl, you are responsible for conducting your own due diligence before making any purchase. This includes verifying the artist's identity, reviewing their work, and ensuring you're comfortable with the transaction terms.</p>
              <p>All payment arrangements and delivery terms are negotiated directly between you and the artist. BrushOwl does not facilitate, mediate, or guarantee these transactions.</p>
              <p>BrushOwl is not responsible for fraud, non-delivery, damaged goods, or any disputes that arise between buyers and artists. We strongly recommend using secure payment methods and clear communication.</p>
            </section>

            <section className="legal-section">
              <h2>5. Artwork Authenticity</h2>
              <p>Artists are responsible for ensuring that the artworks they upload are original or that they possess the legal rights to share them.</p>
              <p>BrushOwl does not verify the authenticity, originality, or ownership of artworks uploaded by users and is not responsible for disputes related to copyright or intellectual property.</p>
            </section>

            <section className="legal-section">
              <h2>6. No Payment or Shipping Involvement</h2>
              <p>BrushOwl operates strictly as a discovery and communication platform. We do not process payments, hold funds, or handle any financial transactions between users.</p>
              <p>We do not ship artwork, manage logistics, or participate in delivery arrangements. BrushOwl is not a party to any transaction between artists and buyers.</p>
              <p className="legal-highlight">
                Critical Notice: Any agreement, payment, refund, or dispute is solely between the artist and buyer. BrushOwl is not responsible for any loss, damage, fraud, failed delivery, or financial disputes.
              </p>
            </section>

            <section className="legal-section">
              <h2>7. Prohibited Content</h2>
              <p>Users are strictly prohibited from uploading or sharing stolen or copyrighted artwork without proper authorization. All content must respect intellectual property rights.</p>
              <p>Hate speech, abusive content, harassment, or discriminatory material of any kind is not tolerated on our platform.</p>
              <p>Explicit, illegal, or content that violates any local, national, or international law is forbidden.</p>
              <p>BrushOwl reserves the right to remove any content or suspend accounts that violate these rules without prior notice.</p>
            </section>

            <section className="legal-section">
              <h2>8. Account Suspension</h2>
              <p>BrushOwl reserves the right to remove artworks, restrict content, suspend, or permanently terminate accounts that violate these Terms of Service or engage in suspicious, fraudulent, abusive, or harmful behavior.</p>
              <p>This includes but is not limited to copyright infringement, impersonation, scams, harassment, or misuse of the platform.</p>
              <p>We may take such actions without prior notice if necessary to protect the safety of users or the integrity of the platform.</p>
            </section>

            <section className="legal-section">
              <h2>9. Limitation of Liability</h2>
              <p>BrushOwl provides the platform on an "as is" and "as available" basis, without any warranties of any kind, either express or implied.</p>
              <p>We are not liable for transaction disputes, loss of money, or any financial damages arising from interactions on our platform. We do not guarantee the accuracy, completeness, or reliability of any content posted by users.</p>
              <p>BrushOwl is not responsible for shipping damage, lost packages, misrepresentation by users, or any indirect or consequential damages.</p>
              <p className="legal-highlight">You use the platform at your own risk. By using BrushOwl, you acknowledge and accept these limitations of liability.</p>
            </section>

            <section className="legal-section">
              <h2>10. Changes to Terms</h2>
              <p>We may update these Terms at any time. Continued use of BrushOwl means you accept the updated Terms.</p>
            </section>

            <section className="legal-section">
              <h2>11. Governing Law</h2>
              <p>These Terms are governed by the laws of India.</p>
              <p>Any disputes shall be subject to the jurisdiction of courts in India.</p>
            </section>

            <div className="legal-footer-note">
              <p>For questions regarding these Terms, contact:</p>
              <a href="mailto:kalarang.team@gmail.com" className="legal-contact-link">
                kalarang.team@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
