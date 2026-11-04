'use client';

import { useEffect } from 'react';

// Locks the page behind whatever is open on top of it. Counted, because panels
// stack (a confirmation over a drawer) and close together: if each one saved and
// restored the page's overflow itself, whichever closed last would put back the
// "hidden" it found, and the page would stay stuck until a reload.
let locks = 0;
let previous = '';

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (locks === 0) {
      previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    locks++;
    return () => {
      locks--;
      if (locks === 0) document.body.style.overflow = previous;
    };
  }, [active]);
}
