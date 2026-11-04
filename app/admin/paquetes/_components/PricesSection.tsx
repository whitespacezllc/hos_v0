'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import type { PriceList, PriceRow } from '@/lib/queries/packs';
import { updatePrices } from '@/app/actions/prices';
import { Button } from '@/components/admin/Button';
import { Card } from '@/components/admin/Card';
import { Input } from '@/components/admin/Input';
import { Modal } from '@/components/admin/Modal';

// Up to two decimals, and no trailing zeros: $17, $16.40.
const money = (n: number) => String(Math.round(n * 100) / 100);

const validPrice = (text: string) => {
  const n = Number(text);
  return text.trim() !== '' && Number.isFinite(n) && n > 0 && n <= 100_000;
};

// What the website charges for one class and for each pack, and the one place
// the studio changes it. Every pack shows what it comes to per class and what it
// saves against the drop-in, live while typing, so a slip is seen before saving.
export function PricesSection({
  priceList,
  onSaved,
}: {
  priceList: PriceList;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const t = useTranslations('admin.packs.prices');
  const tc = useTranslations('admin.common');
  const { dropIn, packs, specialClasses } = priceList;
  const rows = useMemo(() => (dropIn ? [dropIn, ...packs] : packs), [dropIn, packs]);

  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor() {
    setDrafts(Object.fromEntries(rows.map((r) => [r.id, money(r.priceUsd)])));
    setError(null);
    setOpen(true);
  }

  const rowLabel = (r: PriceRow) =>
    r.classesCount === 1 ? t('dropIn') : t('pack', { count: r.classesCount });

  const specialLabel = specialClasses
    .map((c) => `${c.name} (${c.priceUsd === 0 ? tc('status.free') : `$${money(c.priceUsd)}`})`)
    .join(', ');

  const allValid = rows.every((r) => validPrice(drafts[r.id] ?? ''));
  const changed = rows.filter((r) => validPrice(drafts[r.id] ?? '') && Number(drafts[r.id]) !== r.priceUsd);

  async function save() {
    if (!allValid) {
      setError(t('invalid'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await updatePrices(changed.map((r) => ({ id: r.id, priceUsd: Number(drafts[r.id]) })));
      if (!res.ok) {
        setError(res.error === 'not_admin' ? tc('feedback.signedInRequired') : tc('feedback.couldNotSave'));
        return;
      }
      setOpen(false);
      onSaved(res.sessionsUpdated > 0 ? t('savedWithSessions', { count: res.sessionsUpdated }) : t('saved'));
      router.refresh();
    } catch {
      setError(tc('feedback.couldNotSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label={t('heading')} className="mb-8 lg:mb-10">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-body text-lg font-medium text-ink leading-tight">{t('heading')}</h2>
          <p className="font-body text-sm text-ink/70 mt-1">{t('description')}</p>
        </div>
        {rows.length > 0 && (
          <Button
            variant="secondary"
            icon={<Pencil width={16} height={16} strokeWidth={1.5} />}
            onClick={openEditor}
          >
            {t('edit')}
          </Button>
        )}
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        {rows.map((r) => (
          <Card key={r.id} padding="none" className="p-3 sm:p-4">
            <p className="font-body text-xs sm:text-sm text-ink/70 whitespace-nowrap">{rowLabel(r)}</p>
            <p className="font-body text-2xl sm:text-3xl font-light text-ink leading-none mt-2">${money(r.priceUsd)}</p>
            <p className="font-body text-xs text-ink/70 mt-2">
              {r.classesCount === 1
                ? t('dropInHint')
                : t('perClass', { price: money(r.priceUsd / r.classesCount) })}
            </p>
          </Card>
        ))}
      </div>

      {specialClasses.length > 0 && (
        <p className="font-body text-xs text-ink/70 mt-3">{t('specialClasses', { list: specialLabel })}</p>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('modal.title')}
        subtitle={t('modal.subtitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              {tc('actions.cancel')}
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={changed.length === 0 && allValid}>
              {t('modal.save')}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          noValidate
          className="space-y-5"
        >
          {rows.map((r) => {
            const text = drafts[r.id] ?? '';
            const ok = validPrice(text);
            const price = Number(text);
            const dropInDraft = dropIn ? Number(drafts[dropIn.id]) : NaN;
            const saved = r.classesCount * dropInDraft - price;
            const hint = !ok
              ? t('invalid')
              : r.classesCount === 1
              ? t('modal.dropInHint')
              : !Number.isFinite(dropInDraft) || !validPrice(drafts[dropIn?.id ?? ''] ?? '')
              ? t('perClass', { price: money(price / r.classesCount) })
              : saved > 0
              ? `${t('perClass', { price: money(price / r.classesCount) })} · ${t('saves', { amount: money(saved) })}`
              : `${t('perClass', { price: money(price / r.classesCount) })} · ${t('noSaving', { count: r.classesCount })}`;
            return (
              <Input
                key={r.id}
                id={`price-${r.id}`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                label={t('modal.priceOf', { name: rowLabel(r) })}
                value={text}
                onChange={(e) => {
                  setError(null);
                  setDrafts((d) => ({ ...d, [r.id]: e.target.value }));
                }}
                error={ok ? undefined : hint}
                helper={ok ? hint : undefined}
              />
            );
          })}

          <p className="font-body text-sm text-ink/80 bg-neutral-50 border border-ink/10 px-4 py-3">
            {t('modal.note')}
          </p>

          {error && (
            <p role="alert" className="font-body text-sm text-burgundy">
              {error}
            </p>
          )}
          {/* Enter in a field saves, as in every other form of the panel. */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Modal>
    </section>
  );
}
