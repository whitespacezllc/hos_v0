'use client';

import type { ReactNode } from 'react';

// Admin card — base container for content blocks.
// Elevation is carried by the border alone — no shadow, no border-radius.
type Padding = 'default' | 'tight' | 'none';

type CardProps = {
  children: ReactNode;
  padding?: Padding;
  className?: string;
};

const PADDING_CLASSES: Record<Padding, string> = {
  default: 'p-4 sm:p-6',
  tight: 'p-4',
  none: '',
};

export function Card({ children, padding = 'default', className = '' }: CardProps) {
  return (
    <div
      className={`
        min-w-0 bg-white border border-ink/10
        ${PADDING_CLASSES[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
