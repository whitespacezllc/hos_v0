import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { Navigation } from '@/components/landing/navigation';
import { Footer } from '@/components/landing/footer';
import { getPackReceipt } from '@/lib/queries/receipts';
import { Check, X, AlertCircle, Clock } from 'lucide-react';

// The page Tilopay's callback sends a pack buyer to. `order` is the purchase
// id, so a paid pack can show its code right here — the email is on its way,
// but the code is what the customer came for.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Copy = { icon: 'ok' | 'declined' | 'error' | 'review'; title: string; body: string };

type Translate = Awaited<ReturnType<typeof getTranslations<'packs.result'>>>;

// The receipt's words, from the catalogue, for the outcome Tilopay reported.
function copyFor(t: Translate, status: string, kind: string): Copy {
  if (status === 'ok') {
    const which = kind === 'booking' ? 'booking' : 'pack';
    return { icon: 'ok', title: t(`ok.${which}.title`), body: t(`ok.${which}.body`) };
  }
  if (status === 'declined') {
    return { icon: 'declined', title: t('declined.title'), body: t('declined.body') };
  }
  if (status === 'review') {
    return { icon: 'review', title: t('review.title'), body: t('review.body') };
  }
  return { icon: 'error', title: t('error.title'), body: t('error.body') };
}

export default async function ResultadoPage({
  params,
  searchParams,
}: LocaleParams & {
  searchParams: Promise<{ status?: string; kind?: string; order?: string }>;
}) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);
  const t = await getTranslations('packs.result');
  const { status, kind, order } = await searchParams;
  const c = copyFor(t, status ?? 'error', kind ?? 'pack');
  const receipt = status === 'ok' && order ? await getPackReceipt(order) : null;
  const code = receipt?.status === 'paid' ? receipt.code : null;

  return (
    <>
      <Navigation />
      <main id="main-content" className="bg-warm-white min-h-screen">
        <section className="w-[90%] md:w-[80%] max-w-2xl mx-auto pt-36 pb-28">
          <div className="border border-ink/15 bg-white p-10 md:p-14">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-cream">
              {c.icon === 'ok' && <Check width={26} height={26} strokeWidth={1.5} className="text-ink" />}
              {c.icon === 'declined' && <X width={26} height={26} strokeWidth={1.5} className="text-ink" />}
              {c.icon === 'review' && <Clock width={26} height={26} strokeWidth={1.5} className="text-ink" />}
              {c.icon === 'error' && (
                <AlertCircle width={26} height={26} strokeWidth={1.5} className="text-ink" />
              )}
            </div>
            <h1 className="font-display text-3xl font-light text-ink mt-7">{c.title}</h1>
            <p className="font-body text-sm text-ink/70 mt-4 leading-relaxed">{c.body}</p>

            {code && receipt && (
              <div className="mt-8 border border-dashed border-burgundy/60 bg-cream/40 px-6 py-6 text-center">
                <p className="font-body text-[10px] tracking-[0.3em] uppercase text-ink/60">{t('code.label')}</p>
                <p className="font-mono text-2xl tracking-[0.18em] text-ink mt-3">{code}</p>
                <p className="font-body text-xs text-ink/70 mt-4 leading-relaxed">
                  {t('code.body', { count: receipt.classesTotal - receipt.classesUsed })}
                </p>
              </div>
            )}

            <div className="mt-8 flex gap-4">
              <Link
                href="/yoga"
                className="bg-ink text-warm-white font-body text-sm tracking-[0.1em] uppercase px-6 py-3 hover:bg-dark transition-colors duration-200"
              >
                {t('bookClass')}
              </Link>
              {(status === 'declined' || status === 'error') && (
                <Link
                  href="/paquetes"
                  className="border border-ink/25 text-ink font-body text-sm tracking-[0.1em] uppercase px-6 py-3 hover:bg-cream/60 transition-colors duration-200"
                >
                  {t('tryAgain')}
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
