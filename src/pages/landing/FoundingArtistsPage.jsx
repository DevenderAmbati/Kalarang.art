import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowForward, MdAutoAwesome, MdCheckCircle } from 'react-icons/md';
import { FaStar, FaInstagram, FaUserPlus, FaImages } from 'react-icons/fa';
import { getFoundingArtistsCount } from '../../services/userService';
import './legal.css';

const steps = [
  {
    label: 'Create an account',
  },
  {
    label: 'Upload at least 4 of your best artworks',
  },
  {
    label: 'Share a screenshot of your Kalarang portfolio on your Instagram story tagging @kalarang, or send it to us via Instagram DM.',
  },
];

const benefits = [
  'Lifetime free access to the core platform',
  'Early exposure on Kalarang',
  'Founding Artist badge',
];

const FoundingArtistsPage = () => {
  const navigate = useNavigate();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [foundingCount, setFoundingCount] = useState(null);

  useEffect(() => {
    getFoundingArtistsCount().then(setFoundingCount).catch(() => setFoundingCount(0));
  }, []);

  // Lock body scroll while terms modal is open so the whole blurred layer stays fixed
  useEffect(() => {
    if (showTermsModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.dataset.foundingOriginalOverflow = originalOverflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = document.body.dataset.foundingOriginalOverflow || '';
        delete document.body.dataset.foundingOriginalOverflow;
      };
    }
  }, [showTermsModal]);

  return (
    <div className="legal-container">
      {/* Blurred page content */}
      <div className={`founding-page-content ${showTermsModal ? 'founding-page-blurred' : ''}`}>
      <div className="legal-main-content">
        <div className="legal-content-wrapper">
          {/* Back button */}
          <button
            className="legal-back-button"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Header */}
          <div className="legal-header">
     
            <h1 className="legal-title">
              <span className="gradient-text">Kalarang Founding Artists Program</span>
            </h1>
            <p className="legal-subtitle">Be among the first 100 artists on Kalarang.</p>
          </div>

          {/* Content */}
          <div className="legal-content">
            {/* Intro / Description */}
            <div className="legal-intro">
              <p>
                We are inviting the first 100 artists to join Kalarang and get{' '}
                <strong>lifetime free access</strong> to the core platform.
              </p>
            </div>

            {/* How to Join */}
            <section className="legal-section">
              <h2>
                <MdCheckCircle size={20} />
                <span>How to Join</span>
              </h2>
              <ul className="founding-steps-list">
                {steps.map((step, index) => (
                  <li key={index}>
                    <span style={{ fontWeight: 600, marginRight: '0.35rem' }}>
                      {index + 1}.
                    </span>
                    {step.label}
                  </li>
                ))}
              </ul>
            </section>

            {/* Benefits */}
            <section className="legal-section">
              <h2>
                <FaStar size={18} />
                <span>Benefits</span>
              </h2>
              <ul>
                {benefits.map((benefit, index) => (
                  <li key={index}>{benefit}</li>
                ))}
              </ul>
            </section>

            {/* CTA */}
            <section className="legal-section">
              <h2>Become a Founding Artist</h2>
              <p>
                Spots are limited. Join now and be part of the first 100 artists shaping the
                future of Kalarang. This offer is valid until <strong>April 15, 2026</strong>.
              </p>
              <div className="founding-cta-row">
                <button
                  onClick={() => navigate('/signup')}
                  className="login-button primary-cta founding-cta-button"
                >
                  <span>Create Artist Account</span>
                  {MdArrowForward({ size: 14 })}
                </button>
                <div className="founding-cta-counter">
                  <div className="founding-counter-text">
                    <span className="founding-counter-number">{foundingCount ?? '—'} <span className="founding-counter-slash">/</span> 100</span>
                    <span className="founding-counter-label">spots filled · Hurry up!</span>
                  </div>
                  <span className="founding-counter-fire">🔥</span>
                </div>
              </div>
              <button
                type="button"
                className="founding-terms-link"
                onClick={() => setShowTermsModal(true)}
              >
                *Terms and conditions apply.
              </button>
            </section>

 

        

          </div>
        </div>
      </div>
      </div>

      {/* Terms Modal – outside blurred wrapper so it stays sharp */}
      {showTermsModal && (
        <div className="founding-terms-modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div
            className="founding-terms-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="founding-terms-modal-header">
              <h3>Founding Artists Program – Key Terms</h3>
              <button
                type="button"
                className="founding-terms-close"
                onClick={() => setShowTermsModal(false)}
                aria-label="Close terms"
              >
                ✕
              </button>
            </div>
            <div className="founding-terms-modal-body">
              <ul>
                <li>
                  Core platform access includes creating a profile, uploading artworks,
                  showcasing artworks, and selling artworks.
                </li>
                <li>
                  Kalarang reserves the right to review uploaded artworks and may hide artworks
                  or revoke Founding Artist eligibility if they are non-original or low quality.
                </li>
                <li>
                  Kalarang may introduce optional premium features in the future which may
                  have separate pricing.
                </li>
                <li>
                  Kalarang reserves the right to update platform features and program terms
                  if necessary.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FoundingArtistsPage;
