import { useEffect, useRef } from 'react';

interface DrawerBackNavigationOptions {
  drawerOpen: boolean;
  activeChatId: string | null;
  onCloseDrawer: () => void;
  onExitChat: () => void;
}

/**
 * Manages browser history entries for a chat drawer overlay so the
 * browser / mobile back button navigates within the drawer instead
 * of leaving the page.
 *
 * History stack (additions on top of the current entry):
 *   [existing page]  →  { drawer: 'list' }  →  { drawer: 'chat' }
 *
 * Back presses:
 *   inside chat  → pop to list (calls onExitChat)
 *   on list      → pop to page (calls onCloseDrawer)
 */
export function useDrawerBackNavigation({
  drawerOpen,
  activeChatId,
  onCloseDrawer,
  onExitChat,
}: DrawerBackNavigationOptions) {
  // Keep callbacks in refs so the popstate listener never goes stale
  const onCloseRef = useRef(onCloseDrawer);
  const onExitChatRef = useRef(onExitChat);
  onCloseRef.current = onCloseDrawer;
  onExitChatRef.current = onExitChat;

  // Track how many history entries we've pushed (1 = list, 2 = list + chat)
  const depthRef = useRef(0);
  // Guard: when WE programmatically call history.go(), ignore the resulting popstate
  const suppressPopRef = useRef(false);
  const prevChatIdRef = useRef<string | null>(null);

  // --- Drawer open / close ---
  useEffect(() => {
    if (!drawerOpen) {
      // Drawer just closed — silently remove any entries we still own
      if (depthRef.current > 0) {
        suppressPopRef.current = true;
        const n = depthRef.current;
        depthRef.current = 0;
        prevChatIdRef.current = null;
        window.history.go(-n);
      }
      return;
    }

    // Drawer just opened — push the "list" entry
    depthRef.current = 1;
    prevChatIdRef.current = null;
    window.history.pushState({ drawer: 'list' }, '');

    // Popstate handler — single listener for the drawer's lifetime
    const onPop = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        return;
      }

      if (depthRef.current === 2) {
        // Was inside a chat → go back to list
        depthRef.current = 1;
        prevChatIdRef.current = null;
        onExitChatRef.current();
      } else {
        // Was on list (or already 0) → close drawer
        depthRef.current = 0;
        prevChatIdRef.current = null;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [drawerOpen]);

  // --- Chat open / close (within the drawer) ---
  useEffect(() => {
    if (!drawerOpen) return;

    const hadChat = prevChatIdRef.current !== null;
    const hasChat = activeChatId !== null;

    if (hasChat && !hadChat) {
      // Entered a chat — push the "chat" entry
      depthRef.current = 2;
      window.history.pushState({ drawer: 'chat' }, '');
    } else if (!hasChat && hadChat) {
      // Left a chat via UI back button — silently remove the "chat" entry
      if (depthRef.current === 2) {
        suppressPopRef.current = true;
        depthRef.current = 1;
        window.history.go(-1);
      }
    }

    prevChatIdRef.current = activeChatId;
  }, [activeChatId, drawerOpen]);
}
