import React from 'react';

export interface ContainableTarget {
  contains: (node: unknown) => boolean;
}

/**
 * Pure predicate deciding whether a pointer/mouse event happened outside
 * the given menu container element.
 */
export function isEventOutsideContainer(
  container: ContainableTarget | null | undefined,
  target: unknown
): boolean {
  if (!container || !target) return false;
  return !container.contains(target);
}

/**
 * Attaches capture-phase outside-click (`pointerdown` + `mousedown`) and
 * `Escape` key listeners to `targetDoc` while a header dropdown menu is open.
 * Returns a cleanup function.
 */
export function attachHeaderMenuDismissListeners(options: {
  container: ContainableTarget | null | undefined;
  onClose: () => void;
  targetDoc?: Pick<Document, 'addEventListener' | 'removeEventListener'>;
}): () => void {
  const doc =
    options.targetDoc ??
    (typeof document !== 'undefined' ? document : undefined);
  if (!doc) return () => {};

  const handleOutsideEvent = (event: Event) => {
    if (isEventOutsideContainer(options.container, event.target)) {
      options.onClose();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      options.onClose();
    }
  };

  doc.addEventListener('pointerdown', handleOutsideEvent, true);
  doc.addEventListener('mousedown', handleOutsideEvent, true);
  doc.addEventListener('keydown', handleKeyDown as EventListener, true);

  return () => {
    doc.removeEventListener('pointerdown', handleOutsideEvent, true);
    doc.removeEventListener('mousedown', handleOutsideEvent, true);
    doc.removeEventListener('keydown', handleKeyDown as EventListener, true);
  };
}

/**
 * React hook that closes a dropdown menu when the user clicks/taps outside
 * its container ref or presses Escape.
 */
export function useHeaderMenuDismiss(
  isOpen: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void
): void {
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!isOpen) return;
    return attachHeaderMenuDismissListeners({
      container: containerRef.current,
      onClose: () => onCloseRef.current(),
    });
  }, [isOpen, containerRef]);
}
