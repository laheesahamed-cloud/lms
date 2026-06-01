import { useEffect } from 'react';

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((element) => {
      const style = window.getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0;
    });
}

export function useFocusTrap({ active, containerRef, initialFocusRef, onEscape }) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;

    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusTarget = initialFocusRef?.current || getFocusableElements(containerRef.current)[0];
    focusTarget?.focus({ preventScroll: true });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(containerRef.current);
      if (!focusable.length) {
        event.preventDefault();
        containerRef.current?.focus?.({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      previousActiveElement?.focus?.({ preventScroll: true });
    };
  }, [active, containerRef, initialFocusRef, onEscape]);
}
