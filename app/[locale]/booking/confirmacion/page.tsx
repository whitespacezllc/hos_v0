import type { Metadata } from 'next';
import { format } from 'date-fns';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Calendar, MessageCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import { BUSINESS } from '@/lib/business';
import { dateFnsLocale } from '@/lib/dates';
import { inCostaRica } from '@/lib/costa-rica-time';
import { getBookingReceipt, type BookingReceipt } from '@/lib/queries/receipts';
import { BookingHeader } from '@/components/booking/BookingHeader';

// ─── The receipt a card payment comes back to ────────────────────────────────
// Tilopay's callback sends the customer here with their booking reference and
// what happened (ok / declined / review / error). Cash, Venmo and free
// bookings show their receipt inside the flow itself (BookingConfirmation);
// this page exists for the customer who left the site to pay and is coming
// back, and for anyone who opens the link in their email later.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type View = 'confirmed' | 'pending' | 'review' | 'declined' | 'error' | 'notFound';

// Bookings close an hour before class (see startBookingCheckout).
function stillBookable(startsAt: string): boolean {
  return new Date(startsAt).getTime() - Date.now() > 3_600_000;
}

function viewFor(receipt: BookingReceipt | null, status: string | undefined): View {
  if (!receipt) return 'notFound';
  if (status === 'declined') return 'declined';
  if (status === 'review') return 'review';
  if (status === 'error') return 'error';
  switch (receipt.status) {
    case 'confirmed':
      return 'confirmed';
    case 'pending':
      // A card booking still pending after its return is one under review.
      return receipt.paymentMethod === 'card' ? 'review' : 'pending';
    default:
      return 'declined';
  }
}

export default async function ConfirmacionPage({
  params,
  searchParams,
}: LocaleParams & {
  searchParams: Promise<{ ref?: string; status?: string }>;
}) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);
  const t = await getTranslations('booking.receipt');
  const { ref, status } = await searchParams;
  const receipt = ref ? await getBookingReceipt(ref) : null;
  const view = viewFor(receipt, status);
  const showDetails = receipt && (view === 'confirmed' || view === 'pending' || view === 'review');
  const canRebook = receipt ? stillBookable(receipt.startsAt) : false;

  let dateStr = '';
  let timeStr = '';
  if (receipt) {
    const start = inCostaRica(receipt.startsAt);
    const end = inCostaRica(new Date(receipt.startsAt).getTime() + receipt.durationMinutes * 60_000);
    const d = format(start, t('dateFormat'), { locale: dateFnsLocale(locale) });
    dateStr = d.charAt(0).toUpperCase() + d.slice(1);
    timeStr = `${format(start, 'HH:mm')} — ${format(end, 'HH:mm')}`;
  }

  return (
    <PageMessages namespaces={['booking']}>
      <div className="min-h-screen bg-warm-white">
        <BookingHeader step={5} totalSteps={4} isConfirmation />

        <div className="w-full max-w-xl mx-auto px-6 py-16 lg:py-24">
          <div className="text-center">
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-burgundy">
              {t(`eyebrow.${view}`)}
            </p>
            <h1 className="font-display font-light text-ink text-3xl md:text-4xl leading-tight mt-6">
              {t(`headline.${view}`)}
            </h1>
            <p className="font-body text-sm text-ink leading-relaxed mt-6 max-w-md mx-auto">
              {t(`body.${view}`)}
            </p>
          </div>

          {receipt && (
            <div className="mt-14 pt-10 border-t border-ink/15 text-center">
              <p className="font-body text-[10px] tracking-[0.3em] uppercase text-ink">{t('reference')}</p>
              <p className="font-display font-light text-ink text-2xl md:text-3xl mt-3 tracking-[0.08em]">
                {receipt.reference}
              </p>
            </div>
          )}

          {showDetails && receipt && (
            <>
              <div className="mt-10 pt-10 border-t border-ink/15 space-y-3">
                <Row label={t('class')} value={receipt.className} />
                {receipt.instructor && <Row label={t('instructor')} value={receipt.instructor} />}
                <Row label={t('date')} value={dateStr} />
                <Row label={t('time')} value={`${timeStr} · ${t('timezone')}`} />
                <Row label={t('duration')} value={t('minutes', { count: receipt.durationMinutes })} />
                <Row label={t('location')} value={receipt.location} />
              </div>
              <div className="mt-8 pt-6 border-t border-ink/30 flex justify-between items-baseline">
                <span className="font-body text-sm tracking-[0.1em] uppercase text-ink">{t('total')}</span>
                <span className="font-display font-light text-ink text-2xl md:text-3xl">
                  {receipt.totalUsd === 0 ? t('free') : `$${receipt.totalUsd}`}
                </span>
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 mt-14">
            {view === 'declined' && receipt && canRebook ? (
              <Link
                href={`/booking/${receipt.classId}`}
                className="inline-flex items-center gap-2 font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300"
              >
                <Calendar className="w-4 h-4" strokeWidth={1.5} />
                {t('bookAgain')}
              </Link>
            ) : (
              <Link
                href="/yoga"
                className="inline-flex items-center gap-2 font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300"
              >
                <Calendar className="w-4 h-4" strokeWidth={1.5} />
                {t('backToClasses')}
              </Link>
            )}
            <a
              href={BUSINESS.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300"
            >
              <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
              {t('whatsapp')}
            </a>
          </div>
        </div>
      </div>
    </PageMessages>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className="font-body text-sm text-ink">{label}</span>
      <span className="font-body text-sm text-right text-ink">{value}</span>
    </div>
  );
}
