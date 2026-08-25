export const SCROLL_LOCK_EVENT = 'jrc:modal-lock';

interface ScrollLockSnapshot {
  htmlOverflow: string;
  bodyOverflow: string;
  bodyPaddingRight: string;
}

interface ReleaseScrollLockOptions {
  restoreFocus?: HTMLElement | null;
}

function focusWithoutMovingViewport(target: HTMLElement | null | undefined) {
  if (!target?.isConnected) return;
  target.focus({ preventScroll: true });
}

/**
 * Keeps the visual viewport parked while an overlay owns interaction. It locks
 * root overflow instead of fixing the body, so the browser never resets to
 * document origin while Lenis is paused.
 */
export function lockDocumentScroll() {
  const html = document.documentElement;
  const body = document.body;
  const scrollY = window.scrollY;
  const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);
  const snapshot: ScrollLockSnapshot = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
  };
  let released = false;

  window.dispatchEvent(new CustomEvent(SCROLL_LOCK_EVENT, {
    detail: { locked: true, scrollY },
  }));

  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;

  return {
    scrollY,
    release({ restoreFocus }: ReleaseScrollLockOptions = {}) {
      if (released) return;
      released = true;

      html.style.overflow = snapshot.htmlOverflow;
      body.style.overflow = snapshot.bodyOverflow;
      body.style.paddingRight = snapshot.bodyPaddingRight;
      if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      focusWithoutMovingViewport(restoreFocus);

      window.requestAnimationFrame(() => {
        if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
        window.dispatchEvent(new CustomEvent(SCROLL_LOCK_EVENT, {
          detail: { locked: false, scrollY },
        }));
      });
    },
  };
}
