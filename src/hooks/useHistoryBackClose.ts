import { useEffect, useRef } from 'react';

/**
 * Pushes a history entry while a modal/sheet is open so Android back /
 * browser back / edge-swipe closes the overlay instead of leaving the page.
 */
export function useHistoryBackClose(
  isOpen: boolean,
  onClose: () => void,
  stateKey = 'sheet',
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const suppressRef = useRef(false);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (pushedRef.current) {
        pushedRef.current = false;
        suppressRef.current = true;
        window.history.go(-1);
      }
      return;
    }

    pushedRef.current = true;
    window.history.pushState({ [stateKey]: true }, '');

    const onPop = () => {
      if (suppressRef.current) {
        suppressRef.current = false;
        return;
      }
      pushedRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // If still open when unmounting (route change), drop our entry silently.
      if (pushedRef.current) {
        pushedRef.current = false;
        suppressRef.current = true;
        window.history.go(-1);
      }
    };
  }, [isOpen, stateKey]);
}
