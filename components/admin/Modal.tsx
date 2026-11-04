'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// Generic admin modal, used by the Create/Edit forms across the panel.
// DeleteConfirmation is a separate component because its layout is opinionated.
//
// The title and the actions stay put and only the form between them scrolls, so
// Save is always in sight however long the form or short the screen. On a phone
// it opens as a sheet from the bottom, the full width of the screen.
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string; // e.g. "max-w-lg", "max-w-xl"
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-lg',
}: ModalProps) {
  const tc = useTranslations('admin.common');
  // Escape closes the modal.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useScrollLock(isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
          {/* Backdrop */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/40"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-modal-title"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`relative flex flex-col w-full ${maxWidth} max-h-[92dvh] sm:max-h-full bg-white border border-ink/10`}
          >
            {/* Header */}
            <header className="flex-none flex items-start justify-between gap-4 px-5 sm:px-8 pt-5 sm:pt-6 pb-4 border-b border-ink/10">
              <div className="min-w-0">
                <h2
                  id="admin-modal-title"
                  className="font-body text-lg font-medium text-ink leading-tight"
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className="font-body text-sm text-ink/70 mt-1">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={tc('actions.close')}
                className="flex-none -mr-2 -mt-1 w-10 h-10 inline-flex items-center justify-center text-ink/70 hover:text-ink transition-colors duration-200 cursor-pointer"
              >
                <X width={20} height={20} strokeWidth={1.5} />
              </button>
            </header>

            {/* Body — the only part that scrolls */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-8 py-5 sm:py-6">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <footer className="flex-none flex flex-wrap justify-end gap-3 px-5 sm:px-8 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-ink/10">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
