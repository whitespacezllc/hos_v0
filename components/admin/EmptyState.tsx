'use client';

import type { ReactNode } from 'react';

// Empty state — replaces weak "Sin reservas con ese filtro" patterns.
// Consumer passes a lucide icon (already styled at the proper size) as `icon`.
type EmptyStateProps = {
  icon?: ReactNode;
  heading: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, heading, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 lg:py-20 text-center">
      {icon && (
        <div className="text-ink/70 [&>svg]:w-8 [&>svg]:h-8" aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="font-body text-base font-medium text-ink mt-6 leading-tight">
        {heading}
      </h3>
      {description && (
        <p className="font-body text-sm text-ink/70 max-w-sm mt-2 leading-normal">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
