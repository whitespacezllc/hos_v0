import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import { getClassesForWeek, ensureWeekMaterialized } from '@/lib/queries/classes';
import { addDays, startOfWeek } from 'date-fns';
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

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);

  // Fill the current week from the recurring schedule before reading it.
  await ensureWeekMaterialized(weekStart);

  const classes = await getClassesForWeek(weekStart, weekEnd);

  // Serialize Date → string for client component props
  const initialClasses = classes.map((c) => ({
    ...c,
    startsAt: c.startsAt.toISOString(),
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
