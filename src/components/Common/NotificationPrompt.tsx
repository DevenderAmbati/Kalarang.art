import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { enableNotifications, isNotificationsEnabled } from "../../services/fcmService";
import { isSupported } from "firebase/messaging";
import { toast } from "react-toastify";

function storageKey(uid: string, key: string) {
  return `kalarang_notif_${key}_${uid}`;
}

const COOLDOWN_MS = 1 * 24 * 60 * 60 * 1000;

const NotificationPrompt: React.FC = () => {
  const { appUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!appUser?.uid) return;

    const uid = appUser.uid;
    const visitsKey = storageKey(uid, "visits");
    const visits = parseInt(localStorage.getItem(visitsKey) || "0", 10) + 1;
    localStorage.setItem(visitsKey, String(visits));
  }, [appUser?.uid]);

  useEffect(() => {
    let cancelled = false;

    async function shouldShow() {
      if (!appUser?.uid) return;
      const uid = appUser.uid;

      if (localStorage.getItem(storageKey(uid, "banner_stop")) === "true") return;

      if (!("Notification" in window)) return;
      if (Notification.permission === "denied") return;

      if (Notification.permission === "granted") {
        const alreadyEnabled = await isNotificationsEnabled(uid);
        if (alreadyEnabled) return;
      }

      const supported = await isSupported().catch(() => false);
      if (!supported) return;

      const visits = parseInt(localStorage.getItem(storageKey(uid, "visits")) || "0", 10);
      if (visits < 2) return;

      const lastShown = parseInt(localStorage.getItem(storageKey(uid, "banner_last")) || "0", 10);
      if (lastShown > 0 && Date.now() - lastShown < COOLDOWN_MS) return;

      if (!cancelled) {
        setVisible(true);
        localStorage.setItem(storageKey(uid, "banner_last"), String(Date.now()));
      }
    }

    const timer = setTimeout(shouldShow, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [appUser?.uid]);

  const handleEnable = async () => {
    if (!appUser?.uid) return;
    setEnabling(true);
    const result = await enableNotifications(appUser.uid);
    setEnabling(false);

    if (result.success) {
      toast.success("Notifications enabled!", { position: "top-center", autoClose: 2000 });
      setVisible(false);
    } else {
      toast.error(result.error || "Failed to enable notifications", {
        position: "top-center",
        autoClose: 4000,
      });
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  const handleNeverShow = () => {
    if (appUser?.uid) {
      localStorage.setItem(storageKey(appUser.uid, "banner_stop"), "true");
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
    <style>{`
      @keyframes notifBannerSlideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .notif-banner-full { display: inline; }
      .notif-banner-short { display: none; }
      @media (max-width: 639px) {
        .notif-banner-full { display: none; }
        .notif-banner-short { display: inline; }
      }
    `}</style>
    <div style={styles.banner}>
      <div style={styles.content}>
        <span style={styles.icon}>🔔</span>
        <span style={styles.text}>
          <span className="notif-banner-full">Stay updated! Enable notifications for messages and activity.</span>
          <span className="notif-banner-short">Stay updated! Enable notifications.</span>
        </span>
        <button
          onClick={handleEnable}
          disabled={enabling}
          style={{
            ...styles.enableBtn,
            opacity: enabling ? 0.7 : 1,
          }}
        >
          {enabling ? "..." : "Enable"}
        </button>
        <span onClick={handleNeverShow} style={styles.neverLink}>Don't show again</span>
        <button onClick={handleDismiss} style={styles.closeBtn} aria-label="Dismiss">
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
    animation: "notifBannerSlideDown 0.25s ease-out",
  },
  content: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  icon: {
    fontSize: "0.8rem",
    flexShrink: 0,
    filter: "brightness(10)",
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
  enableBtn: {
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

export default NotificationPrompt;
