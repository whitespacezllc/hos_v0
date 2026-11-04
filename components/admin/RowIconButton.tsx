'use client';

// Reusable row action button — consistent across all admin lists. A finger gets
// 40px; a mouse gets 32px and a tooltip that says what the icon does.
export function RowIconButton({
  children,
  onClick,
  ariaLabel,
  disabled,
  hoverDestructive = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  hoverDestructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      className={`
        w-10 h-10 md:w-8 md:h-8 p-1.5 inline-flex items-center justify-center flex-shrink-0
        text-ink/70 hover:bg-neutral-100
        ${hoverDestructive ? 'hover:text-burgundy' : 'hover:text-ink'}
        transition-colors duration-200 cursor-pointer
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
}
