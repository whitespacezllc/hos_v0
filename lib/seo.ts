// ─── Metadata builder ────────────────────────────────────────────────────────
// One helper behind every page's `metadata`, so canonicals, Open Graph and
// language alternates can never drift page by page.
//
// The site is bilingual: English at the bare path, Spanish under `/es`, both
// server-rendered and both indexable. Everything that differs between the two
// lives in this file and nowhere else — a page passes its English path and the
// locale it is rendering in, and gets back a self-referencing canonical, the
// full hreflang set and the right `og:locale`.
//
// No page component needs to know how a locale becomes a URL — `localizedPath`
// is the only place that decides, and it agrees with i18n/routing.ts by
// construction: English is the default locale and carries no prefix, every
// other locale is its code.

import type { Metadata } from 'next';
import { BUSINESS, absoluteUrl } from '@/lib/business';
import type { AppLocale } from '@/i18n/routing';

export type Locale = AppLocale;

/**
 * Locales published. Both are live: every page renders in each, the
 * alternates name both, and the sitemap lists both.
 */
export const ACTIVE_LOCALES: readonly Locale[] = ['en', 'es'] as const;

export const DEFAULT_LOCALE: Locale = 'en';

/** Open Graph and hreflang codes, per locale. */
const LOCALE_META: Record<Locale, { og: string; hreflang: string }> = {
  en: { og: 'en_US', hreflang: 'en' },
  // Generic Spanish, not `es-CR`: the copy is neutral Latin American Spanish
  // written for readers arriving from anywhere in the Spanish-speaking world,
  // and a bare `es` is what matches all of them. `es_ES` is the Open Graph
  // code the platforms actually recognise for Spanish.
  es: { og: 'es_ES', hreflang: 'es' },
};

/**
 * Where a given page lives for a given locale.
 *
 * English keeps the bare path (no `/en` prefix — it is the default and a
 * prefix would force a redirect on every existing inbound link). Spanish lives
 * under `/es`. This is the single place that mapping is expressed.
 */
export function localizedPath(path: string, locale: Locale = DEFAULT_LOCALE): string {
  const clean = path === '/' ? '' : path.replace(/\/$/, '');
  return locale === DEFAULT_LOCALE ? clean || '/' : `/${locale}${clean}`;
}

/** Absolute canonical for a page in a locale. */
export function canonicalUrl(path: string, locale: Locale = DEFAULT_LOCALE): string {
  return absoluteUrl(localizedPath(path, locale));
}

/**
 * The `alternates.languages` map: one entry per published locale plus
 * `x-default`, which points at English as the version to serve when no
 * language matches. The same map, page by page, feeds the sitemap.
 */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of ACTIVE_LOCALES) {
    languages[LOCALE_META[locale].hreflang] = canonicalUrl(path, locale);
  }
  languages['x-default'] = canonicalUrl(path, DEFAULT_LOCALE);
  return languages;
}

/**
 * `og:locale` for the page being rendered, and `og:locale:alternate` for every
 * other published locale — so a share of `/es/yoga` is tagged Spanish and still
 * announces that an English version exists.
 */
export function openGraphLocale(locale: Locale): { locale: string; alternateLocale: string[] } {
  return {
    locale: LOCALE_META[locale].og,
    alternateLocale: ACTIVE_LOCALES.filter((l) => l !== locale).map((l) => LOCALE_META[l].og),
  };
}

export type PageImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

/** The site-wide social card. 1200×630, tracked in git. */
export const DEFAULT_OG_IMAGE: PageImage = {
  url: '/og-image.jpg',
  alt: 'House of Shakti — a yoga sanctuary in the jungle above Playa Hermosa, Santa Teresa, Costa Rica',
  width: 1200,
  height: 630,
};

/**
 * The favicon set, shared by every root layout (the public site, the admin
 * panel, the instructor portal) so the tab icon is the same everywhere.
 *
 * `favicon.svg` used to head this list, but it was not a vector: a 512px
 * <rect> filled with a pattern pointing at an embedded base64 raster, 88 KB
 * of PNG wearing an SVG costume, served on every page. The PNG beside it was
 * 2287×1693 and not square, so every browser and every home screen was
 * squashing a landscape image into a square slot.
 *
 * Both are replaced by square icons cut from the same artwork: the mark's
 * real bounding box, centred with breathing room. 156 KB became 23 KB.
 */
export const SITE_ICONS: NonNullable<Metadata['icons']> = {
  icon: [{ url: '/favicon.png', type: 'image/png', sizes: '192x192' }],
  shortcut: '/favicon.png',
  // iOS composites transparency onto black, so the touch icon carries the
  // brand cream behind the mark rather than a transparent background.
  apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
};

/**
 * The social card per page: the photograph that page opens on, cut to 1200×630
 * in public/og/. A page without one shares the site card. Keyed by the
 * English path, which is what every page passes to buildMetadata.
 */
const PAGE_IMAGES: Record<string, PageImage> = {
  '/yoga': {
    url: '/og/yoga.jpg',
    alt: 'The open-air yoga shala at House of Shakti, looking out over the jungle of Santa Teresa',
    width: 1200,
    height: 630,
  },
  '/stay-with-us': {
    url: '/og/stay-with-us.jpg',
    alt: 'The house and its saltwater pool at House of Shakti, Santa Teresa',
    width: 1200,
    height: 630,
  },
  '/retreats': {
    url: '/og/retreats.jpg',
    alt: 'Mats laid out in the yoga shala at House of Shakti before a retreat session',
    width: 1200,
    height: 630,
  },
  '/upcoming-retreats': {
    url: '/og/upcoming-retreats.jpg',
    alt: 'The yoga shala at House of Shakti seen from the garden during a class',
    width: 1200,
    height: 630,
  },
  '/shakti-experience': {
    url: '/og/shakti-experience.jpg',
    alt: 'Two guests walking the beach at low tide in Santa Teresa, Costa Rica',
    width: 1200,
    height: 630,
  },
  '/host-your-retreat': {
    url: '/og/host-your-retreat.jpg',
    alt: 'The Santa Teresa coastline seen from above, jungle meeting the Pacific',
    width: 1200,
    height: 630,
  },
  '/yoga-teacher-training': {
    url: '/og/yoga-teacher-training.jpg',
    alt: 'A yoga posture on the beach at sunset in Santa Teresa',
    width: 1200,
    height: 630,
  },
};
// The class-pack shop is a door into the same classes.
PAGE_IMAGES['/paquetes'] = PAGE_IMAGES['/yoga'];

export function pageImage(path: string): PageImage {
  return PAGE_IMAGES[path] ?? DEFAULT_OG_IMAGE;
}

export type BuildMetadataInput = {
  /** Site-relative path, English form, e.g. `/stay-with-us`. */
  path: string;
  /** Page title, without the site suffix — the template in the root layout adds it. */
  title: string;
  /** Under 160 characters. */
  description: string;
  /** Defaults to the page's own card (see PAGE_IMAGES), then to the site card. */
  image?: PageImage;
  /** The locale the page is rendering in — the `[locale]` segment. */
  locale?: Locale;
  /**
   * Bypass the root layout's `%s | House of Shakti` template. Used by the home
   * page, whose title already names the business — templated it would read
   * "House of Shakti — … | House of Shakti".
   */
  absoluteTitle?: boolean;
};

export function buildMetadata({
  path,
  title,
  description,
  image: explicitImage,
  locale = DEFAULT_LOCALE,
  absoluteTitle = false,
}: BuildMetadataInput): Metadata {
  const image = explicitImage ?? pageImage(path);
  // Self-referencing: the Spanish page's canonical is the Spanish URL. The
  // alternates below are what tie the two versions together.
  const canonical = canonicalUrl(path, locale);

  // The root layout's `%s | House of Shakti` template applies to <title> only.
  // Open Graph and Twitter take whatever string they are given, so a page
  // titled "About" would share as a card reading "About" and nothing else.
  // Both get the title as it will actually render.
  const socialTitle = absoluteTitle ? title : `${title} | ${BUSINESS.name}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(path),
    },
    openGraph: {
      type: 'website',
      siteName: BUSINESS.name,
      ...openGraphLocale(locale),
      url: canonical,
      title: socialTitle,
      description,
      images: [
        {
          url: absoluteUrl(image.url),
          alt: image.alt,
          ...(image.width ? { width: image.width } : {}),
          ...(image.height ? { height: image.height } : {}),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [absoluteUrl(image.url)],
    },
  };
}
