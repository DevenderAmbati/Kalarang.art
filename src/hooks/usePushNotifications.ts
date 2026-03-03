import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  enableNotifications,
  disableNotifications,
  isNotificationsEnabled,
} from "../services/fcmService";
import { toast } from "react-toastify";

export function usePushNotifications() {
  const { appUser } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!appUser?.uid) {
        setEnabled(false);
        setLoading(false);
        return;
      }
      try {
        const active = await isNotificationsEnabled(appUser.uid);
        if (!cancelled) setEnabled(active);
      } catch {
        if (!cancelled) setEnabled(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [appUser?.uid]);

  const toggle = useCallback(async () => {
    if (!appUser?.uid || toggling) return;
    setToggling(true);

    try {
      if (enabled) {
        await disableNotifications(appUser.uid);
        setEnabled(false);
      } else {
        const result = await enableNotifications(appUser.uid);
        if (result.success) {
          setEnabled(true);
        } else {
          toast.error(result.error || "Failed to enable notifications", {
            position: "top-center",
            autoClose: 4000,
          });
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update notification settings", {
        position: "top-center",
        autoClose: 4000,
      });
    } finally {
      setToggling(false);
    }
  }, [appUser?.uid, enabled, toggling]);

  return { enabled, loading, toggling, toggle };
}
