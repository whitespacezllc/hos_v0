'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';

// DeleteConfirmation — reusable destructive-action modal.
//
// The parent owns the open state AND the close-after-success behavior: this
// component does NOT auto-close on confirm — it only fires `onConfirm`. The
// parent should close it once the underlying mutation succeeds.
type DeleteConfirmationProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
};

export function DeleteConfirmation({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  loading = false,
}: DeleteConfirmationProps) {
  const tc = useTranslations('admin.common');
  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, loading]);

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
            onClick={() => !loading && onClose()}
            className="absolute inset-0 bg-ink/40"
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirmation-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative max-w-md w-full mx-6 bg-white border border-ink/10 p-8"
          >
            <h2
              id="delete-confirmation-title"
              className="font-body text-lg font-medium text-ink leading-tight"
            >
              {title}
            </h2>
            <p className="font-body text-sm text-ink/60 leading-normal mt-3">
              {description}
            </p>

            <div className="flex justify-end gap-3 mt-8">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={loading}
              >
                {cancelLabel ?? tc('actions.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={onConfirm}
                loading={loading}
              >
                {confirmLabel ?? tc('actions.delete')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
