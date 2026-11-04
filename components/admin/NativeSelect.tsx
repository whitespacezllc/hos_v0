'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { Field } from './Field';

// Native <select> with a custom chevron. Used inside admin forms
// and as a lightweight filter dropdown in table toolbars.
type Option = { value: string; label: string };
type NativeSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label?: string;
  helper?: string;
  error?: string;
  options: Option[];
  /** When true, render without the Field wrapper (used in toolbars). */
  bare?: boolean;
  /** When true, use the toolbar/filter visual treatment (more compact). */
  filter?: boolean;
};

const CHEVRON_BG =
  "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23313131' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")";

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  function NativeSelect(
    { label, helper, error, options, bare = false, filter = false, className = '', ...props },
    ref,
  ) {
    const select = (
      <select
        ref={ref}
        {...props}
        className={`
          appearance-none bg-white bg-no-repeat min-w-0 max-w-full pl-3 pr-9
          ${filter ? 'h-10 text-base md:text-sm' : 'block w-full h-11 text-base'}
          border ${error ? 'border-burgundy' : 'border-ink/20 focus:border-ink'}
          font-body text-ink
          outline-none cursor-pointer transition-colors duration-200
          ${className}
        `}
        style={{
          backgroundImage: CHEVRON_BG,
          backgroundPosition: 'right 10px center',
          backgroundSize: '18px 18px',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );

    if (bare || filter) return select;
    return (
      <Field label={label} helper={helper} error={error} htmlFor={props.id}>
        {select}
      </Field>
    );
  },
);
