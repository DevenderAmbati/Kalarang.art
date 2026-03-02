import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useAuth } from '../../context/AuthContext';
import { MdInstallMobile } from 'react-icons/md';

const SESSION_SHOWN_KEY = 'kalarang-pwa-prompt-shown-session';
const INSTALL_PROMPT_ACTIVE_KEY = 'kalarang-install-prompt-active';

interface InstallPromptProps {
  onVisibilityChange?: (visible: boolean) => void;
}

const InstallPrompt: React.FC<InstallPromptProps> = ({ onVisibilityChange }) => {
  const { shouldShowPrompt, triggerInstall, dismissPermanently } = usePwaInstall();
  const { firebaseUser } = useAuth();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
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
        sessionStorage.setItem(INSTALL_PROMPT_ACTIVE_KEY, 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, shouldShowPrompt]);

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  const hide = useCallback(() => {
    setVisible(false);
    sessionStorage.removeItem(INSTALL_PROMPT_ACTIVE_KEY);
  }, []);

  const handleInstall = useCallback(async () => {
    await triggerInstall();
    hide();
  }, [triggerInstall, hide]);

  const handleSkip = useCallback(() => {
    hide();
  }, [hide]);

  const handleNeverShow = useCallback(() => {
    dismissPermanently();
    hide();
  }, [dismissPermanently, hide]);

  if (!visible) return null;

  return (
    <>
    <style>{`
      @keyframes installBannerSlideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .install-banner-full { display: inline; }
      .install-banner-short { display: none; }
      @media (max-width: 639px) {
        .install-banner-full { display: none; }
        .install-banner-short { display: inline; }
      }
    `}</style>
    <div style={styles.banner}>
      <div style={styles.content}>
        <span style={styles.icon}>{MdInstallMobile({size: 14, color: '#fff'})}</span>
        <span style={styles.text}>
          <span className="install-banner-full">Install Kalarang app for faster access and a native app experience!</span>
          <span className="install-banner-short">Install app for better experience!</span>
        </span>
        <button onClick={handleInstall} style={styles.installBtn}>
          Install
        </button>
        <span onClick={handleNeverShow} style={styles.neverLink}>Don't show again</span>
        <button onClick={handleSkip} style={styles.closeBtn} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  banner: {
    width: "100%",
    backgroundColor: "var(--color-primary, #0d9488)",
    padding: "0.25rem 1rem",
    animation: "installBannerSlideDown 0.25s ease-out",
  },
  content: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  icon: {
    fontSize: "0.85rem",
    flexShrink: 0,
    color: "#fff",
    fontWeight: 700,
  },
  text: {
    fontSize: "0.7rem",
    color: "#fff",
    flex: 1,
    lineHeight: 1.2,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  installBtn: {
    padding: "0.15rem 0.5rem",
    backgroundColor: "#fff",
    color: "var(--color-primary, #0d9488)",
    border: "none",
    borderRadius: "4px",
    fontSize: "0.65rem",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  neverLink: {
    fontSize: "0.6rem",
    color: "rgba(255, 255, 255, 0.6)",
    cursor: "pointer",
    textDecoration: "underline",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "0.75rem",
    color: "rgba(255, 255, 255, 0.8)",
    cursor: "pointer",
    padding: "0.1rem",
    lineHeight: 1,
    flexShrink: 0,
  },
};

export default InstallPrompt;
