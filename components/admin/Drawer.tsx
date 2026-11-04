'use client';

import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '@/hooks/use-scroll-lock';

// Side panel for a record's details — full screen on a phone, a column on the
// right from `sm` up. Escape and the backdrop close it, and the page behind
// doesn't scroll while it's open.
export function Drawer({
  isOpen,
  onClose,
  ariaLabel,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // A form or a confirmation open on top gets the Escape, not the drawer.
      if (e.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length === 1) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/30"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] xl:w-[480px] bg-white border-l border-ink/10 overflow-y-auto overscroll-contain"
          >
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
