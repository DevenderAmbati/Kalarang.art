import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaInstagram } from 'react-icons/fa';
import './Footer.css';

const Footer: React.FC = () => {
  const navigate = useNavigate();

  return (
    <footer className="home-footer">
      {/* Block 1: Logo */}
      <div className="home-footer-block home-footer-logo-block">
        <img
          src="/logobong.png"
          alt="BrushOwl"
          className="home-footer-logo"
        />
      </div>

      {/* Block 2: Legal Links */}
      <div className="home-footer-block home-footer-legal-block">
        <a 
          onClick={() => navigate('/privacy')}
          className="home-footer-link"
        >
          Privacy Policy
        </a>
        <a 
          onClick={() => navigate('/terms')}
          className="home-footer-link"
        >
          Terms of Service
        </a>
      </div>

      {/* Block 3: Contact Links */}
      <div className="home-footer-block home-footer-contact-block">
        <a 
          href="https://www.instagram.com/brushowlapp" 
          target="_blank" 
          rel="noopener noreferrer"
          className="home-footer-link home-footer-insta"
          title="Follow us on Instagram"
        >
          {FaInstagram({ size: 18 })}
          <span>brushowlapp</span>
        </a>
        <a 
          href="mailto:hello@brushowl.com" 
          className="home-footer-link home-footer-email"
        >
          hello@brushowl.com
        </a>
      </div>
    </footer>
  );
};

export default Footer;
