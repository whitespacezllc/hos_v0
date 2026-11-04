'use client';

import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

// Admin button — 4 variants, no border-radius, all sized consistently.
// See /app/admin/DESIGN_SYSTEM.md for the design rationale.
type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

type ButtonProps = {
  variant?: Variant;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  ariaLabel?: string;
};

// Per-variant class strings. Kept verbose (not via `cva`/`clsx`) so it's easy
// to scan and tweak without indirection.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-burgundy text-cream px-5 py-2.5 text-sm font-medium hover:bg-dark transition-colors duration-200 ease-out',
  secondary:
    'bg-transparent border border-ink/25 text-ink px-5 py-2.5 text-sm font-medium hover:bg-black hover:text-white hover:border-black transition-colors duration-200 ease-out',
  tertiary:
    'bg-transparent text-ink px-3 py-2 text-sm hover:opacity-70 transition-opacity duration-200 ease-out',
  destructive:
    'bg-burgundy text-cream px-5 py-2.5 text-sm font-medium hover:bg-dark transition-colors duration-200 ease-out',
};

export function Button({
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  children,
  onClick,
  type = 'button',
  className = '',
  ariaLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className={`
        font-body inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap
        ${VARIANT_CLASSES[variant]}
        ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
      ) : (
        icon && <span className="inline-flex">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
}
