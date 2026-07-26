import { useEffect, useRef } from 'react';

interface UseSheetDragCloseOptions {
  isOpen: boolean;
  onClose: () => void;
  /** The sheet panel that moves with the drag. */
  sheetRef: React.RefObject<HTMLElement | null>;
  /** Drag starts only from this handle/header (not the scrollable body). */
  handleRef: React.RefObject<HTMLElement | null>;
  /** Pixels of downward drag required to dismiss. */
  thresholdPx?: number;
}

/**
 * Drag-down-to-dismiss for bottom sheets. Only starts when the pointer
 * begins on `handleRef` so message/comment lists keep scrolling normally.
 */
export function useSheetDragClose({
  isOpen,
  onClose,
  sheetRef,
  handleRef,
  thresholdPx = 100,
}: UseSheetDragCloseOptions): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const startY = useRef(0);
  const dragging = useRef(false);
  const currentY = useRef(0);

  useEffect(() => {
    if (!isOpen) return;

    const handle = handleRef.current;
    const sheet = sheetRef.current;
    if (!handle || !sheet) return;

    const reset = () => {
      dragging.current = false;
      currentY.current = 0;
      sheet.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
      sheet.style.transform = '';
      window.setTimeout(() => {
        if (sheet) sheet.style.transition = '';
      }, 300);
    };

    const onPointerDown = (e: PointerEvent) => {
      // Only primary touch / left click
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;
      dragging.current = true;
      startY.current = e.clientY;
      currentY.current = 0;
      sheet.style.transition = 'none';
      handle.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dy = e.clientY - startY.current;
      if (dy <= 0) {
        currentY.current = 0;
        sheet.style.transform = 'translateY(0)';
        return;
      }
      currentY.current = dy;
      sheet.style.transform = `translateY(${dy}px)`;
    };

    const onPointerUp = () => {
      if (!dragging.current) return;
      const dy = currentY.current;
      dragging.current = false;
      if (dy >= thresholdPx) {
        sheet.style.transition = 'transform 0.22s ease-in';
        sheet.style.transform = 'translateY(110%)';
        window.setTimeout(() => onCloseRef.current(), 200);
      } else {
        reset();
      }
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);

    return () => {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerUp);
      sheet.style.transform = '';
      sheet.style.transition = '';
    };
  }, [isOpen, sheetRef, handleRef, thresholdPx]);
}
