import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { after } from 'next/server';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import { getClassesForWeek, ensureWeekMaterialized } from '@/lib/queries/classes';
import { addDays, endOfDay } from 'date-fns';
import { costaRicaWeekStart, toInstantIso } from '@/lib/costa-rica-time';
import { releaseStaleCardHolds } from '@/lib/checkout/core';
import YogaPageClient from './YogaPageClient';
import { FaqJsonLd, YogaClassesJsonLd } from '@/components/seo/JsonLd';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: 'yoga.meta' });
  return buildMetadata({
    path: '/yoga',
    title: t('title'),
    description: t('description'),
    // Already names the business — the root template would repeat it.
    absoluteTitle: true,
    locale,
  });
}

// The current week must be materialized + read fresh on every visit.
export const dynamic = 'force-dynamic';

export default async function YogaPage({ params }: LocaleParams) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);
  const messages = await getMessages();

  // This week in Santa Teresa: Monday 00:00 to Sunday 23:59 Costa Rica time.
  // The server's own clock (UTC on Vercel) is six hours ahead and used to turn
  // the page over to next week at 18:00 on Sunday — and to end the week at
  // Sunday 00:00, leaving Sunday's classes off the first paint.
  const weekStart = costaRicaWeekStart();
  const weekEnd = endOfDay(addDays(weekStart, 6));

  // Fill the current week from the recurring schedule before reading it. The
  // spots of card checkouts that never came back from Tilopay are given back
  // after the page has been sent — the sweep talks to Tilopay and must never
  // slow a visitor down.
  await ensureWeekMaterialized(weekStart);
  after(() => releaseStaleCardHolds());

  const classes = await getClassesForWeek(weekStart, weekEnd);

  // Serialize Date → string for client component props
  const initialClasses = classes.map((c) => ({
    ...c,
    startsAt: toInstantIso(c.startsAt),
  }));

  return (
    <PageMessages namespaces={['yoga']}>
      {/* The page's questions, for the answer engines: what a guest asks, as they ask it. */}
      <FaqJsonLd items={messages.yoga.faq.items} />
      {/* The week's real classes as Event structured data — dated, priced and
          bookable. Renders nothing when the week comes back empty. */}
      <YogaClassesJsonLd classes={classes} />
      <YogaPageClient initialClasses={initialClasses} />
    </PageMessages>
  );
}
