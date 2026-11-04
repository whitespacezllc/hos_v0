'use client';

import { useState } from 'react';

// A date filter that says when it's off. An empty `<input type="date">` paints
// today's date in Safari (and dd/mm/yyyy elsewhere), which reads as a filter
// being applied when none is. While empty and not being edited, the native text
// is hidden and the label for "no filter" sits in its place.
export function DateFilter({
  label,
  ariaLabel,
  emptyLabel,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  ariaLabel: string;
  emptyLabel: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const [focused, setFocused] = useState(false);
  const showEmpty = !value && !focused;

  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="font-body text-xs text-ink/70">{label}</span>
      <span className="relative block">
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={ariaLabel}
          className={`
            block w-full min-w-0 md:w-[9.5rem] h-10 px-3 bg-white appearance-none
            border border-ink/20 focus:border-ink
            font-body text-base md:text-sm outline-none transition-colors duration-200
            ${showEmpty ? 'text-transparent [&::-webkit-datetime-edit]:text-transparent' : 'text-ink'}
          `}
        />
        {showEmpty && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-3 right-8 flex items-center pointer-events-none font-body text-base md:text-sm text-ink/60 truncate"
          >
            {emptyLabel}
          </span>
        )}
      </span>
    </label>
  );
}
