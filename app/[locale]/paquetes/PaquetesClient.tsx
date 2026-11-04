'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Navigation } from '@/components/landing/navigation';
import { Footer } from '@/components/landing/footer';
import { startPackCheckout } from '@/app/actions/packs';
import type { ClassPack } from '@/lib/queries/packs';
import { Check } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { SHALA_POLICY_PATH } from '@/lib/shala-policy';

type Status = 'idle' | 'submitting' | 'error';

export default function PaquetesClient({ packs }: { packs: ClassPack[] }) {
  const t = useTranslations('packs');
  const locale = useLocale();
  const [selected, setSelected] = useState<string>(packs[0]?.id ?? '');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const selectedPack = packs.find((p) => p.id === selected);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPack) return;
    if (!form.firstName || !form.lastName || !form.email) {
      setError(t('errors.incomplete'));
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setError('');
    const res = await startPackCheckout({
      packId: selectedPack.id,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || undefined,
      // Carried through Tilopay's return URL, so the receipt and the code
      // email come back in the language the pack was bought in.
      locale,
    });
    if (res.ok) {
      // Hand off to Tilopay's secure hosted payment page.
      window.location.href = res.url;
    } else {
      setError(
        res.error === 'payment_init_failed' ? t('errors.payment') : t('errors.generic'),
      );
      setStatus('error');
    }
  }

  return (
    <>
      <Navigation />
      <main id="main-content" className="bg-warm-white min-h-screen">
        <section className="w-[90%] md:w-[80%] max-w-5xl mx-auto pt-32 pb-24">
          <h1 className="font-display text-4xl md:text-5xl font-light text-ink leading-tight">
            {t('heading')}
          </h1>
          <p className="font-body text-base text-ink/70 mt-4 max-w-xl leading-relaxed">
            {t('intro')}
          </p>

          {(
            <div className="mt-14 grid md:grid-cols-2 gap-12 lg:gap-20">
              {/* Pack selection */}
              <div>
                <h2 className="font-body text-[11px] tracking-[0.2em] uppercase text-ink/50 mb-5">
                  {t('choose')}
                </h2>
                <div className="space-y-3">
                  {packs.map((p) => {
                    // Up to two decimals, so a price the studio sets never rounds into a lie.
                    const perClass = Math.round((p.priceUsd / p.classesCount) * 100) / 100;
                    const active = p.id === selected;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelected(p.id)}
                        className={`w-full text-left px-5 py-4 border transition-colors duration-200 flex items-center justify-between ${
                          active
                            ? 'border-ink bg-cream/40'
                            : 'border-ink/15 hover:border-ink/40'
                        }`}
                      >
                        <div>
                          <p className="font-body text-sm font-medium text-ink">{p.name}</p>
                          <p className="font-body text-xs text-ink/50 mt-0.5">
                            {t('perClass', { count: p.classesCount, price: perClass })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-display text-xl font-light text-ink">
                            ${p.priceUsd}
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              active ? 'border-ink bg-ink' : 'border-ink/30'
                            }`}
                          >
                            {active && <Check width={11} height={11} className="text-warm-white" />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {packs.length === 0 && (
                    <p className="font-body text-sm text-ink/50 italic">
                      {t('none')}
                    </p>
                  )}
                </div>
              </div>

              {/* Buyer details */}
              <form onSubmit={handleSubmit}>
                <h2 className="font-body text-[11px] tracking-[0.2em] uppercase text-ink/50 mb-5">
                  {t('details')}
                </h2>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <TextField
                      label={t('firstName')}
                      value={form.firstName}
                      onChange={(v) => update('firstName', v)}
                    />
                    <TextField
                      label={t('lastName')}
                      value={form.lastName}
                      onChange={(v) => update('lastName', v)}
                    />
                  </div>
                  <TextField
                    label={t('email')}
                    type="email"
                    value={form.email}
                    onChange={(v) => update('email', v)}
                  />
                  <TextField
                    label={t('phone')}
                    value={form.phone}
                    onChange={(v) => update('phone', v)}
                  />
                </div>

                {error && (
                  <p className="font-body text-xs italic text-burgundy mt-4">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'submitting' || !selectedPack}
                  className="mt-8 w-full bg-ink text-warm-white font-body text-sm tracking-[0.1em] uppercase py-4 hover:bg-dark transition-colors duration-200 disabled:opacity-50 cursor-pointer"
                >
                  {status === 'submitting'
                    ? t('processing')
                    : selectedPack
                    ? t('continueWith', { price: selectedPack.priceUsd })
                    : t('continue')}
                </button>
                <p className="font-body text-xs text-ink/40 mt-4 leading-relaxed">
                  {t('note')}
                </p>
                <Link
                  href={SHALA_POLICY_PATH}
                  target="_blank"
                  className="inline-block font-body text-xs text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300 mt-3"
                >
                  {t('policyLink')}
                </Link>
              </form>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block font-body text-[10px] tracking-[0.2em] uppercase text-ink/50 mb-2">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-0 border-b border-ink/25 bg-transparent px-0 py-2 font-body text-sm text-ink outline-none focus:border-ink transition-colors duration-200"
      />
    </label>
  );
}
