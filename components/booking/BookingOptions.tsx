'use client';

import { forwardRef } from 'react';
import { useTranslations } from 'next-intl';

/**
 * One way to book the class: on its own (`packId` null), or with a pack whose
 * first credit is this class. Prices come from the database, as the checkout
 * charges them.
 */
export type BookingOption = {
  /** 'dropin', or the class_packs id. */
  id: string;
  packId: string | null;
  classes: number;
  price: number;
  /** What one class costs inside this option. */
  perClass: number;
  /** Against booking that many classes one by one at the standard drop-in price. */
  saving: number;
};

/** $17, $19.80 — whole dollars stay whole. */
export function usd(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/** The option's name, as the summary, the recap and the receipt say it. */
export function useOptionLabel() {
  const t = useTranslations('booking.options');
  return (o: Pick<BookingOption, 'packId' | 'classes'>) =>
    o.packId ? t('packOf', { count: o.classes }) : t('dropin');
}

/** What the option covers, in one short line. */
export function useOptionDetail() {
  const t = useTranslations('booking.options');
  return (o: BookingOption) =>
    o.packId
      ? t('packDetail', { rest: o.classes - 1, perClass: usd(o.perClass) })
      : t('dropinDetail');
}

type Props = {
  options: BookingOption[];
  /** Nothing is chosen for the customer: null until they pick. */
  value: string | null;
  onChange: (id: string) => void;
  /** Set when they tried to go on without choosing. */
  showRequired: boolean;
};

/**
 * Drop-in or a pack, chosen on the first step, next to the class itself: the
 * price of everything after it depends on this. Native radios sharing a name,
 * so the arrow keys and the screen reader work as they do anywhere; the radio
 * itself is hidden and the row is the target. A radiogroup rather than a
 * fieldset: a legend can't be laid out like the headings around it.
 *
 * The ref is the group: asked to choose, the flow scrolls here and focuses it
 * — not the first radio, which would look like a choice made for them.
 */
export const BookingOptions = forwardRef<HTMLDivElement, Props>(function BookingOptions(
  { options, value, onChange, showRequired },
  ref,
) {
  const t = useTranslations('booking.options');
  const label = useOptionLabel();
  const detail = useOptionDetail();

  return (
    <section className="mt-12 pt-10 border-t border-ink/10">
      <h2
        id="booking-options-title"
        className="font-display font-light text-ink text-2xl lg:text-[1.75rem] leading-tight"
      >
        {t('title')}
      </h2>
      <p className="font-body text-sm text-ink leading-relaxed mt-3 max-w-md">{t('intro')}</p>

      <div
        ref={ref}
        role="radiogroup"
        aria-labelledby="booking-options-title"
        aria-required="true"
        aria-invalid={showRequired || undefined}
        aria-describedby={showRequired ? 'booking-options-required' : undefined}
        tabIndex={-1}
        className={`mt-8 border-y divide-y divide-ink/10 transition-colors duration-300 scroll-mt-28 focus:outline-none ${
          showRequired ? 'border-burgundy/60' : 'border-ink/10'
        }`}
      >
        {options.map((o) => {
          const active = value === o.id;
          return (
            <label
              key={o.id}
              className={`
                group relative flex items-center justify-between gap-4
                py-5 pl-8 pr-2 cursor-pointer
                transition-colors duration-300
                has-[:focus-visible]:outline has-[:focus-visible]:outline-1
                has-[:focus-visible]:outline-ink has-[:focus-visible]:-outline-offset-1
                ${active ? 'bg-cream/60' : 'hover:bg-ink/[0.02]'}
              `}
            >
              <input
                type="radio"
                name="booking-option"
                value={o.id}
                checked={active}
                onChange={() => onChange(o.id)}
                className="sr-only"
              />
              {/* Burgundy marker on the left of the chosen row. */}
              <span
                aria-hidden
                className={`
                  absolute left-0 top-1/2 -translate-y-1/2 h-10 w-[2px] bg-burgundy
                  transition-opacity duration-300
                  ${active ? 'opacity-100' : 'opacity-0'}
                `}
              />
              <span className="flex items-start gap-4 min-w-0">
                <span
                  aria-hidden
                  className={`
                    mt-0.5 w-4 h-4 rounded-full border flex-shrink-0
                    flex items-center justify-center transition-colors duration-300
                    ${active ? 'border-ink' : 'border-ink/40'}
                  `}
                >
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-ink" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-sm font-medium text-ink">{label(o)}</span>
                  <span className="block font-body text-xs text-ink/70 mt-1 leading-snug">{detail(o)}</span>
                  {o.saving > 0 && (
                    <span className="block font-body text-xs text-burgundy mt-1">
                      {t('savings', { amount: usd(o.saving) })}
                    </span>
                  )}
                </span>
              </span>
              <span className="font-display font-light text-ink text-xl lg:text-2xl flex-shrink-0">
                ${usd(o.price)}
              </span>
            </label>
          );
        })}
      </div>

      {showRequired && (
        <p id="booking-options-required" role="alert" className="font-body text-xs text-burgundy mt-3">
          {t('required')}
        </p>
      )}

      {/* A pack bought before is spent as a drop-in with its code. */}
      <p className="font-body text-xs text-ink/70 leading-relaxed mt-5">
        {t.rich('haveCode', {
          choose: (chunks) => (
            <button
              type="button"
              onClick={() => onChange('dropin')}
              className="underline underline-offset-4 decoration-[0.5px] text-ink hover:opacity-70 transition-opacity duration-300 cursor-pointer"
            >
              {chunks}
            </button>
          ),
        })}
      </p>
    </section>
  );
});
