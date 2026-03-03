import { useEffect, useRef } from 'react';

interface ImagePreviewBackNavigationOptions {
  isPreviewOpen: boolean;
  onClosePreview: () => void;
}

/**
 * Manages browser history entries for an image preview overlay so the
 * browser / mobile back button closes the preview instead of navigating
 * away from the page.
 *
 * History stack: [existing page] → { imagePreview: 'open' }
 *
 * Back press while preview is open → closes preview (calls onClosePreview)
 */
export function useImagePreviewBackNavigation({
  isPreviewOpen,
  onClosePreview,
}: ImagePreviewBackNavigationOptions) {
  // Keep callback in ref so the popstate listener never goes stale
  const onCloseRef = useRef(onClosePreview);
  onCloseRef.current = onClosePreview;

  // Track whether we've pushed a history entry
  const hasPushedRef = useRef(false);
  // Guard: when WE programmatically call history.go(), ignore the resulting popstate
  const suppressPopRef = useRef(false);

  useEffect(() => {
    if (!isPreviewOpen) {
      // Preview just closed — silently remove the entry if we still own it
      if (hasPushedRef.current) {
        suppressPopRef.current = true;
        hasPushedRef.current = false;
        window.history.go(-1);
      }
      return;
    }

    // Preview just opened — push the "imagePreview" entry
    hasPushedRef.current = true;
    window.history.pushState({ imagePreview: 'open' }, '');

    // Popstate handler — listen for back button press
    const onPop = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        return;
      }

      // User pressed back — close the preview
      hasPushedRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isPreviewOpen]);
}
