'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { Field } from './Field';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  helper?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helper, error, className = '', rows = 3, ...props },
  ref,
) {
  return (
    <Field label={label} helper={helper} error={error} htmlFor={props.id}>
      <textarea
        ref={ref}
        rows={rows}
        {...props}
        className={`
          block w-full min-w-0 px-3 py-2.5 bg-white resize-y
          border ${error ? 'border-burgundy' : 'border-ink/20 focus:border-ink'}
          font-body text-base text-ink leading-normal
          outline-none transition-colors duration-200
          placeholder:text-ink/50
          ${className}
        `}
      />
    </Field>
  );
});
