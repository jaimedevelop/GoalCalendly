import { useEffect, useState } from 'react';

// Some existing dialogs use Radix, while older ones use a fixed backdrop.
const blockers = '[role="dialog"], [aria-modal="true"], [data-popup-blocker], .fixed.inset-0[class*="bg-black"]';

function available() {
  return document.visibilityState !== 'hidden' && !Array.from(document.querySelectorAll<HTMLElement>(blockers))
    .some(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
}

/** Defer popup mounting/timers until the page is visible and existing dialogs have closed. */
export function usePopupAvailability() {
  const [canShow, setCanShow] = useState(available);
  useEffect(() => {
    const update = () => setCanShow(available());
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'style', 'open', 'aria-modal', 'data-state', 'data-popup-blocker'] });
    document.addEventListener('visibilitychange', update);
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return canShow;
}
