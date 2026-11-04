'use client';

import type { ReactNode } from 'react';

// Admin badge — status indicator / category label.
// Earth-tone palette (see DESIGN_SYSTEM.md §2 — Accent palette).
// No border-radius. Border, text and a faint fill share the same accent hue, so
// a status can be told apart at a glance.
type Variant = 'active' | 'inactive' | 'warning' | 'destructive' | 'neutral';

type BadgeProps = {
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

// Hardcoded earth-tone hex values via Tailwind arbitrary syntax. We avoid
// adding these to globals.css so they stay scoped to the admin.
const VARIANT_CLASSES: Record<Variant, string> = {
  active: 'border-[#6B7355]/50 bg-[#6B7355]/10 text-[#4F5640]', // olive / sage
  inactive: 'border-[#7A6B5D]/40 bg-[#7A6B5D]/10 text-[#5E5247]', // warm gray
  warning: 'border-[#8B6F47]/50 bg-[#8B6F47]/10 text-[#6A5436]', // terracotta
  destructive: 'border-burgundy/40 bg-burgundy/5 text-burgundy', // #8D0000
  neutral: 'border-ink/25 text-ink/70',
};

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center whitespace-nowrap
        px-2 py-0.5
        font-body text-xs font-medium
        border
        ${VARIANT_CLASSES[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
