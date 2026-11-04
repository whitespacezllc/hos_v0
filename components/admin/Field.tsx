'use client';

import type { ReactNode } from 'react';

// Form field wrapper — label + input + helper/error text.
// Used by Input, Textarea, NativeSelect, and any custom input element.
type FieldProps = {
  label?: string;
  helper?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, helper, error, htmlFor, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block font-body text-sm text-ink/80 mb-1.5"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="font-body text-xs text-burgundy mt-1.5">{error}</p>
      ) : helper ? (
        <p className="font-body text-xs text-ink/70 mt-1.5">{helper}</p>
      ) : null}
    </div>
  );
}
