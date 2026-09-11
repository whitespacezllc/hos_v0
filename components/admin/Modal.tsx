'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// Editorial admin modal. Generic wrapper used by Create/Edit forms across
// /clases, /upsells, /refers. DeleteConfirmation is a separate component
// because its layout is opinionated.
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

  // Body scroll lock while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`relative w-full ${maxWidth} mx-6 max-h-[90vh] overflow-y-auto bg-white border border-ink/10 p-8`}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label={tc('actions.close')}
              className="absolute top-6 right-6 text-ink/60 hover:text-ink transition-colors duration-200 cursor-pointer"
            >
              <X width={20} height={20} strokeWidth={1.5} />
            </button>

            {/* Header */}
            <header className="pr-10">
              <h2
                id="admin-modal-title"
                className="font-body text-lg font-medium text-ink leading-tight"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="font-body text-xs text-ink/50 mt-1">{subtitle}</p>
              )}
            </header>

            {/* Body */}
            <div className="mt-6">{children}</div>

            {/* Footer */}
            {footer && (
              <footer className="flex justify-end gap-3 mt-10 pt-6 border-t border-ink/10">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
