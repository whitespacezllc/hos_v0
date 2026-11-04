'use client';

import type { ReactNode } from 'react';

// PageHeader — consistent header for every admin page.
// Layout:
//   sm and up: heading left, actions right, bottom-aligned
//   Phone:     stacked, actions below the heading
type PageHeaderProps = {
  heading: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ heading, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 sm:gap-6 mb-6 lg:mb-8">
      <div className="min-w-0">
        <h1 className="font-body text-2xl lg:text-3xl font-normal text-black leading-tight">
          {heading}
        </h1>
        {description && (
          <p className="font-body text-sm text-ink/70 leading-normal mt-2">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-3 sm:flex-shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
