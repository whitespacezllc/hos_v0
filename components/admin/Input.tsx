'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Field } from './Field';

// Input — a plain box with square corners: its edges say where to type.
// Wraps a Field by default so most call sites just pass label + register.
type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helper?: string;
  error?: string;
  bare?: boolean; // skip Field wrapper if true
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, bare = false, className = '', ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      {...props}
      className={`
        block w-full min-w-0 h-11 px-3 bg-white appearance-none
        border ${error ? 'border-burgundy' : 'border-ink/20 focus:border-ink'}
        font-body text-base text-ink
        outline-none transition-colors duration-200
        placeholder:text-ink/50
        ${className}
      `}
    />
  );

  if (bare) return input;
  return (
    <Field label={label} helper={helper} error={error} htmlFor={props.id}>
      {input}
    </Field>
  );
});
