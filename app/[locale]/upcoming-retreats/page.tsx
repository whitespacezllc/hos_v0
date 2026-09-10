import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import { Navigation } from '@/components/landing/navigation';
import { Footer } from '@/components/landing/footer';
import { UpcomingHero } from '@/components/upcoming-retreats/UpcomingHero';
import { UpcomingGrid, type RetreatCard } from '@/components/upcoming-retreats/UpcomingGrid';
import { getPublishedRetreatListings } from '@/lib/queries/retreatListings';
import {
  DEFAULT_RETREAT_IMAGE,
  SEED_RETREAT_LISTINGS,
  formatRetreatDates,
  isSitePath,
  splitRetreatListings,
  todayInCostaRica,
} from '@/lib/retreat-listings';
import type { RetreatListing } from '@/types';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: 'upcomingRetreats.meta' });
  return buildMetadata({
    path: '/upcoming-retreats',
    title: t('title'),
    description: t('description'),
    locale,
  });
}

// The retreats come from the panel now. The page is built once and rebuilt
// on a timer and on every save in the panel, so an edit shows within seconds
// and a retreat crosses into "past" within the interval of its own accord.
export const revalidate = 600;

// No table yet → the four the page carried before it had one. A read that
// fails while the site is being built (a preview build, a local build with
// placeholder env) → the same four, and the first revalidation replaces
// them. A read that fails at run time → throw: a rebuild that throws keeps
// serving the last good page, which is the admin's real list, and that is
// better than the seeds standing in for it.
async function loadListings(): Promise<RetreatListing[]> {
  try {
    return (await getPublishedRetreatListings()) ?? SEED_RETREAT_LISTINGS;
  } catch (err) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.error('[upcoming-retreats] read failed during the build, shipping the seed:', err);
      return SEED_RETREAT_LISTINGS;
    }
    throw err;
  }
}

export default async function UpcomingRetreatsPage({ params }: LocaleParams) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);

  const listings = await loadListings();
  const { upcoming, past } = splitRetreatListings(listings, todayInCostaRica());

  const toCard = (l: RetreatListing): RetreatCard => ({
    id: l.id,
    label: (locale === 'es' && l.labelEs) || l.label,
    instructors: l.instructors,
    title: l.title,
    dates: formatRetreatDates(l.startsOn, l.endsOn, locale),
    description: (locale === 'es' && l.descriptionEs) || l.description,
    image: l.imageUrl || DEFAULT_RETREAT_IMAGE,
    alt: (locale === 'es' && l.imageAltEs) || l.imageAlt || `${l.title} — ${l.instructors}`,
    href: l.url,
    external: !isSitePath(l.url),
  });

  return (
    <PageMessages namespaces={['upcomingRetreats']}>
      <main id="main-content" className="bg-warm-white overflow-hidden">
        <Navigation />
        <UpcomingHero />
        <UpcomingGrid upcoming={upcoming.map(toCard)} past={past.map(toCard)} />
        <Footer />
      </main>
    </PageMessages>
  );
}
