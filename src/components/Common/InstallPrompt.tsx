import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useAuth } from '../../context/AuthContext';
import './InstallPrompt.css';

const SESSION_SHOWN_KEY = 'kalarang-pwa-prompt-shown-session';

const InstallPrompt: React.FC = () => {
  const { shouldShowPrompt, triggerInstall, dismissPermanently } = usePwaInstall();
  const { firebaseUser } = useAuth();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [neverShow, setNeverShow] = useState(false);
  const shownThisSession = useRef(sessionStorage.getItem(SESSION_SHOWN_KEY) === 'true');
  const prevUser = useRef(firebaseUser);

  useEffect(() => {
    if (prevUser.current && !firebaseUser) {
      sessionStorage.removeItem(SESSION_SHOWN_KEY);
      shownThisSession.current = false;
    }
    prevUser.current = firebaseUser;
  }, [firebaseUser]);

  useEffect(() => {
    if (location.pathname === '/home' && shouldShowPrompt && !shownThisSession.current) {
      const timer = setTimeout(() => {
        setVisible(true);
        shownThisSession.current = true;
        sessionStorage.setItem(SESSION_SHOWN_KEY, 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, shouldShowPrompt]);

  const handleInstall = useCallback(async () => {
    const accepted = await triggerInstall();
    if (accepted) {
      setVisible(false);
    }
  }, [triggerInstall]);

  const handleSkip = useCallback(() => {
    if (neverShow) {
      dismissPermanently();
    }
    setVisible(false);
  }, [neverShow, dismissPermanently]);

  if (!visible) return null;

  return createPortal(
    <div className="install-modal-overlay" onClick={handleSkip}>
      <div className="install-modal" onClick={(e) => e.stopPropagation()}>
        <img
          src="/logo.png"
          alt="Kalarang"
          className="install-modal-logo"
        />
        <h2 className="install-modal-title">Install Kalarang</h2>
        <p className="install-modal-description">
          Get the full app experience — faster access, works offline, and feels like a native app on your device.
        </p>
        <p className="install-modal-profile-hint">
          You can always install later from your Profile page.
        </p>

        <div className="install-modal-actions">
          <button className="install-modal-btn-install" onClick={handleInstall}>
            Install Now
          </button>
          <button className="install-modal-btn-skip" onClick={handleSkip}>
            Skip for Now
          </button>
        </div>

        <label className="install-modal-never-row">
          <input
            type="checkbox"
            className="install-modal-checkbox"
            checked={neverShow}
            onChange={(e) => setNeverShow(e.target.checked)}
          />
          <span className="install-modal-never-label">Don't show this again</span>
        </label>
      </div>
    </div>,
    document.body
  );
};

export default InstallPrompt;
