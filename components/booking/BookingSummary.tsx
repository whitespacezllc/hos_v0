'use client';

import { addMinutes, format } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import type { Upsell, ReferralCode } from '@/types';
import { dateFnsLocale } from '@/lib/dates';
import { inCostaRica } from '@/lib/costa-rica-time';

type Props = {
  className: string;
  instructor: string;
  classDate: Date;
  durationMinutes: number;
  priceUsd: number;
  /** Label for the primary line item — "Class" for a drop-in, or the pack name. */
  priceLabel?: string;
  selectedUpsells: Upsell[];
  appliedCode: ReferralCode | null;
  discountAmount: number;
  total: number;
  isFree: boolean;
  /** When true, the wrapper drops its bg + padding so it can live inside another container (mobile drawer). */
  bare?: boolean;
};

/**
 * Persistent class summary. Lives in the desktop sidebar (sticky) and
 * inside the mobile drawer (when expanded). No class image — the photo
 * lives only inside Step 1's main content area.
 */
export function BookingSummary({
  className, instructor, classDate, durationMinutes,
  priceUsd, priceLabel, selectedUpsells, appliedCode, discountAmount, total, isFree, bare = false,
}: Props) {
  const t = useTranslations('booking.summary');
  const locale = dateFnsLocale(useLocale());
  // Santa Teresa's clock, whatever the reader's.
  const start = inCostaRica(classDate);
  const dateStr = format(start, t('dateFormat'), { locale });
  const timeStr = `${format(start, 'HH:mm')} — ${format(addMinutes(start, durationMinutes), 'HH:mm')}`;

  return (
    <div className={bare ? '' : 'bg-cream p-6 lg:p-8'}>
      <h2 className="font-display font-light text-ink text-xl lg:text-2xl leading-tight">
        {className}
      </h2>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 mt-6">
        <MetaPair label={t('date')} value={dateStr} />
        <MetaPair label={t('time')} value={timeStr} note={t('timezone')} />
        <MetaPair label={t('instructor')} value={instructor} />
        <MetaPair
          label={t('duration')}
          value={t('minutes', { count: durationMinutes })}
        />
      </div>

      <div className="h-px bg-ink/10 my-8" />

      {/* Line items */}
      <div className="space-y-2">
        <LineRow
          label={priceLabel ?? t('classLabel')}
          amount={isFree ? t('free') : `$${priceUsd}`}
        />
        {selectedUpsells.map((u) => (
          <LineRow
            key={u.id}
            label={u.name}
            amount={u.priceUsd === 0 ? t('included') : `+$${u.priceUsd}`}
          />
        ))}
        {appliedCode && discountAmount > 0 && (
          <LineRow
            label={t('code', { code: appliedCode.code })}
            amount={`−$${discountAmount}`}
            tone="burgundy"
          />
        )}
      </div>

      {/* Total */}
      <div className="mt-6 pt-6 border-t border-ink/10 flex justify-between items-baseline">
        <span className="font-body text-sm tracking-[0.1em] uppercase text-ink">
          {t('total')}
        </span>
        <span className="font-display text-2xl lg:text-3xl font-light text-ink">
          {total === 0 ? t('free') : `$${total}`}
        </span>
      </div>
    </div>
  );
}

function MetaPair({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="font-body text-[10px] tracking-[0.25em] uppercase text-ink">{label}</p>
      <p className="font-body text-sm text-ink mt-1">{value}</p>
      {note && <p className="font-body text-[11px] text-ink/60 mt-0.5">{note}</p>}
    </div>
  );
}

function LineRow({
  label, amount, tone,
}: { label: string; amount: string; tone?: 'burgundy' }) {
  const color = tone === 'burgundy' ? 'text-burgundy' : 'text-ink';
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className={`font-body text-sm ${color}`}>{label}</span>
      <span className={`font-body text-sm ${color}`}>{amount}</span>
    </div>
  );
}
