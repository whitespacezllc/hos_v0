import { z } from 'zod';
import type { AppLocale } from '@/i18n/routing';
import type { RetreatListing } from '@/types';
import { BUSINESS } from '@/lib/business';

// ─── Retreat listings ────────────────────────────────────────────────────────
// What the panel and the public page agree on: how long a description may
// run, what a link may look like, how a pair of dates is written out in each
// language, and which side of today a retreat falls on. The rows themselves
// live in Supabase (retreat_listings, migration 007); this module holds the
// rules, so the form validates with the same words the server refuses with.

/** The description is brief on purpose: the cards sit in a row and share a baseline. */
export const RETREAT_DESCRIPTION_MAX = 260;
export const RETREAT_LABEL_MAX = 40;
export const RETREAT_TITLE_MAX = 80;
export const RETREAT_INSTRUCTORS_MAX = 120;

/**
 * The card frames its photograph at 16:15 — nearly square, a touch taller
 * than wide. This is the size to ask for: cover for the largest card at 2×
 * and still light. Anything else is cropped to the frame, centred.
 */
export const RETREAT_IMAGE = { width: 1200, height: 1125, ratio: 'aspect-[16/15]' } as const;

/** A house photograph for a listing saved without one. */
export const DEFAULT_RETREAT_IMAGE = '/images/upcoming_retreats/upcoming_retreats.webp';

// ── Links ────────────────────────────────────────────────────────────────────

/** A page on this site ("/yoga-teacher-training") rather than the wider web. */
export function isSitePath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

// The site's own hostnames, with and without www.
const SITE_HOSTS = new Set(
  [new URL(BUSINESS.url).hostname].flatMap((h) => [h, h.startsWith('www.') ? h.slice(4) : `www.${h}`]),
);

/**
 * What the admin typed, made into something a browser can open — and, for
 * the site's own pages, into the shape the page can route. A bare
 * "wa.me/506…" or "ellymiles.com/retreat" gets its https://. A link to this
 * site, whether pasted as "https://houseofshaktiyoga.com/es/retreats" or as
 * "/es/retreats", is kept as a locale-less path ("/retreats"): the card
 * prefixes the reader's own language, and a path that already carried one
 * would come out as /es/es/… . Whitespace never survives.
 */
export function normalizeRetreatUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return url;
  if (!isSitePath(url) && !/^https?:\/\//i.test(url) && /^[\w.-]+\.[a-z]{2,}(\/|$|\?|#)/i.test(url)) {
    url = `https://${url}`;
  }
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (SITE_HOSTS.has(parsed.hostname.toLowerCase())) {
        url = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
      }
    } catch {
      return url;
    }
  }
  if (isSitePath(url)) url = url.replace(/^\/(en|es)(?=\/|\?|#|$)/i, '') || '/';
  return url;
}

export function isValidRetreatUrl(url: string): boolean {
  if (isSitePath(url)) return /^\/[\w\-./?=&#%]*$/.test(url);
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// ── Validation ───────────────────────────────────────────────────────────────
// One schema for the form and the server action. The Spanish fields are
// optional and arrive as empty strings from the form; they are stored as
// NULL, which the page reads as "reuse the English".
//
// The words the schema refuses with are the reader's: the form builds the
// schema with the panel's catalogue (admin.retreats.validation), while the
// server action keeps the English set below — and the form maps a server
// message back to its key, so an admin reading in Spanish never sees the
// English one.
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type RetreatListingMessages = {
  titleRequired: string;
  titleTooLong: string;
  labelRequired: string;
  labelTooLong: string;
  instructorsRequired: string;
  instructorsTooLong: string;
  startsOnRequired: string;
  endsOnRequired: string;
  descriptionRequired: string;
  /** Also the Spanish description's: the two share a limit. */
  descriptionTooLong: string;
  urlRequired: string;
  urlInvalid: string;
  endsBeforeStarts: string;
};

/** The English set: what the server action validates with. */
export const RETREAT_LISTING_MESSAGES_EN: RetreatListingMessages = {
  titleRequired: 'Give the retreat a name.',
  titleTooLong: `Keep the name under ${RETREAT_TITLE_MAX} characters.`,
  labelRequired: 'Add a label — the kind of retreat it is.',
  labelTooLong: `Keep the label under ${RETREAT_LABEL_MAX} characters.`,
  instructorsRequired: 'Add who runs it.',
  instructorsTooLong: `Keep it under ${RETREAT_INSTRUCTORS_MAX} characters.`,
  startsOnRequired: 'Pick the first day.',
  endsOnRequired: 'Pick the last day.',
  descriptionRequired: 'Add a brief description.',
  descriptionTooLong: `Keep it under ${RETREAT_DESCRIPTION_MAX} characters.`,
  urlRequired: 'Add the link "More info" should open.',
  urlInvalid: 'Use a full link (https://…), a WhatsApp link, or a page on this site (/…).',
  endsBeforeStarts: 'The last day can’t be before the first.',
};

const optionalText = (max: number, tooLong: string) =>
  z.string().trim().max(max, tooLong).default('');

export function buildRetreatListingSchema(m: RetreatListingMessages) {
  return z
    .object({
      title: z.string().trim().min(1, m.titleRequired).max(RETREAT_TITLE_MAX, m.titleTooLong),
      label: z.string().trim().min(1, m.labelRequired).max(RETREAT_LABEL_MAX, m.labelTooLong),
      instructors: z
        .string()
        .trim()
        .min(1, m.instructorsRequired)
        .max(RETREAT_INSTRUCTORS_MAX, m.instructorsTooLong),
      startsOn: z.string().regex(DATE, m.startsOnRequired),
      endsOn: z.string().regex(DATE, m.endsOnRequired),
      description: z
        .string()
        .trim()
        .min(1, m.descriptionRequired)
        .max(RETREAT_DESCRIPTION_MAX, m.descriptionTooLong),
      url: z
        .string()
        .trim()
        .min(1, m.urlRequired)
        .transform(normalizeRetreatUrl)
        .refine(isValidRetreatUrl, m.urlInvalid),
      imageUrl: z.string().trim().nullable().default(null),
      labelEs: optionalText(RETREAT_LABEL_MAX, m.labelTooLong),
      descriptionEs: optionalText(RETREAT_DESCRIPTION_MAX, m.descriptionTooLong),
      isPublished: z.boolean().default(true),
    })
    .refine((v) => v.endsOn >= v.startsOn, {
      message: m.endsBeforeStarts,
      path: ['endsOn'],
    });
}

/** The schema in English — what the server action re-validates with. */
export const retreatListingSchema = buildRetreatListingSchema(RETREAT_LISTING_MESSAGES_EN);

/**
 * A message the server refused with, matched back to its key so the form
 * can say it in the reader's language. Null for anything that is not one
 * of the schema's own words (a database error, say).
 */
export function retreatListingMessageKey(message: string): keyof RetreatListingMessages | null {
  const hit = Object.entries(RETREAT_LISTING_MESSAGES_EN).find(([, english]) => english === message);
  return hit ? (hit[0] as keyof RetreatListingMessages) : null;
}

/** What the form holds — strings throughout, the way inputs give them. */
export type RetreatListingFormValues = z.input<typeof retreatListingSchema>;
/** What comes out of the schema — trimmed, normalised, defaults filled in. */
export type RetreatListingInput = z.output<typeof retreatListingSchema>;

// ── Today, in Costa Rica ─────────────────────────────────────────────────────
// A retreat is over when its last day is behind today's date *there*: the
// house runs on UTC−6 with no daylight saving, so today is the UTC clock
// pushed back six hours, whatever the server's own zone is.
export function todayInCostaRica(now: Date = new Date()): string {
  return new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isPastRetreat(listing: Pick<RetreatListing, 'endsOn'>, today: string): boolean {
  return listing.endsOn < today;
}

/**
 * Upcoming first-to-last, so the nearest retreat is the first one read;
 * past most-recent-first, so the row of what has been starts with what has
 * just been. Ties break on the end date, then the name.
 */
export function splitRetreatListings<T extends Pick<RetreatListing, 'startsOn' | 'endsOn' | 'title'>>(
  listings: T[],
  today: string,
): { upcoming: T[]; past: T[] } {
  const byStart = (a: T, b: T) =>
    a.startsOn.localeCompare(b.startsOn) || a.endsOn.localeCompare(b.endsOn) || a.title.localeCompare(b.title);
  const byEndDesc = (a: T, b: T) =>
    b.endsOn.localeCompare(a.endsOn) || b.startsOn.localeCompare(a.startsOn) || a.title.localeCompare(b.title);
  return {
    upcoming: listings.filter((l) => !isPastRetreat(l, today)).sort(byStart),
    past: listings.filter((l) => isPastRetreat(l, today)).sort(byEndDesc),
  };
}

// ── Dates, written out ───────────────────────────────────────────────────────
// "Sep 6–12, 2026" · "Nov 21 – Dec 4, 2026" · "Dec 28, 2026 – Jan 3, 2027"
// "6–12 sep 2026" · "21 nov – 4 dic 2026"  · "28 dic 2026 – 3 ene 2027"
// Hand-set abbreviations rather than Intl's: Spanish "sept." and the trailing
// periods would break the site's existing style, which these strings match.
const MONTHS: Record<AppLocale, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
};

function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

export function formatRetreatDates(startsOn: string, endsOn: string, locale: AppLocale): string {
  const a = parts(startsOn);
  const b = parts(endsOn);
  const M = MONTHS[locale];
  const sameMonth = a.y === b.y && a.m === b.m;
  const sameYear = a.y === b.y;
  const single = startsOn === endsOn;

  if (locale === 'es') {
    if (single) return `${a.d} ${M[a.m - 1]} ${a.y}`;
    if (sameMonth) return `${a.d}–${b.d} ${M[a.m - 1]} ${a.y}`;
    if (sameYear) return `${a.d} ${M[a.m - 1]} – ${b.d} ${M[b.m - 1]} ${a.y}`;
    return `${a.d} ${M[a.m - 1]} ${a.y} – ${b.d} ${M[b.m - 1]} ${b.y}`;
  }
  if (single) return `${M[a.m - 1]} ${a.d}, ${a.y}`;
  if (sameMonth) return `${M[a.m - 1]} ${a.d}–${b.d}, ${a.y}`;
  if (sameYear) return `${M[a.m - 1]} ${a.d} – ${M[b.m - 1]} ${b.d}, ${a.y}`;
  return `${M[a.m - 1]} ${a.d}, ${a.y} – ${M[b.m - 1]} ${b.d}, ${b.y}`;
}

// ── The four the page carried before it had a table ─────────────────────────
// Seeded by migration 007 and kept here as the page's fallback for a deploy
// that reaches Vercel before the migration reaches the database: the page
// then shows exactly what it showed the day before, and says so in the log.
// Once the table exists these are never read. Keep both copies in step.
// The ids match migration 007's, so a fallback card and its row are the same retreat.
const seeded = (
  id: string,
  row: Omit<RetreatListing, 'id' | 'isPublished' | 'createdAt' | 'updatedAt'>,
): RetreatListing => ({
  id: `00000000-0000-4000-8000-00000000000${id}`,
  isPublished: true,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
  ...row,
});

export const SEED_RETREAT_LISTINGS: RetreatListing[] = [
  seeded('1', {
    title: 'Sol for Soul',
    label: 'Wellness Retreat',
    instructors: 'Elly Miles',
    startsOn: '2026-09-06',
    endsOn: '2026-09-12',
    description:
      'A portal into yourself, held in a container that feels light, supportive and fun — built around the way Santa Teresa naturally invites you to open up and come alive.',
    url: 'https://www.ellymiles.com/costaricaseptember',
    imageUrl: '/images/upcoming/sol-for-soul.jpg',
    imageAlt: 'A guest stepping out into the morning at House of Shakti',
    imageAltEs: 'Una huésped saliendo a la mañana en House of Shakti',
    labelEs: 'Retiro de bienestar',
    descriptionEs:
      'Un portal hacia ti, sostenido en un contenedor ligero, acompañado y divertido, construido alrededor de la manera en que Santa Teresa te invita naturalmente a abrirte y sentirte con vida.',
  }),
  seeded('2', {
    title: 'The Awakened Body: A Tantric Yoga Intensive',
    label: 'Yoga Teacher Training',
    instructors: 'Nancy Goodfellow',
    startsOn: '2026-11-21',
    endsOn: '2026-12-04',
    description:
      'A transformational immersion for those who wish to deepen their relationship with yoga beyond the physical practice. One hundred hours on the embodied path of Tantra — movement, breath, ritual and self-inquiry.',
    url: '/yoga-teacher-training',
    imageUrl: '/images/introduction/ytt-introduction-07.webp',
    imageAlt: 'A group practising together in the open shala',
    imageAltEs: 'Un grupo practicando junto en la shala abierta',
    labelEs: 'Yoga Teacher Training',
    descriptionEs:
      'Una inmersión transformadora para quienes desean profundizar su relación con el yoga más allá de la práctica física. Cien horas en el camino encarnado del Tantra: movimiento, respiración, ritual e indagación interior.',
  }),
  seeded('3', {
    title: 'NOURISH: 50hr Restorative + Yin Training',
    label: 'Yoga Training',
    instructors: 'Sam Bianchini',
    startsOn: '2026-12-05',
    endsOn: '2026-12-12',
    description:
      'A week-long retreat paired with a rich, life-affirming study of Restorative and Yin Yoga — and how to hold healing space in your own original medicine.',
    url: 'https://sambianchini.com/retreats',
    imageUrl: '/images/upcoming/nourish.webp',
    imageAlt: 'A group resting through a restorative practice in the shala',
    imageAltEs: 'Un grupo descansando en una práctica restaurativa en la shala',
    labelEs: 'Formación de yoga',
    descriptionEs:
      'Un retiro de una semana unido a un estudio rico y vital del Yoga Restaurativo y el Yin, y de cómo sostener un espacio de sanación desde tu propia medicina original.',
  }),
  seeded('4', {
    title: 'SALVAJE',
    label: 'Transformational Retreat',
    instructors: 'Heather Nil',
    startsOn: '2027-01-18',
    endsOn: '2027-01-23',
    description:
      'More than a retreat — an awakening. For anyone seeking an experience to shake their world and bring their HELL YES energy back.',
    url: 'https://www.canva.com/design/DAGlZEo1TOg/gc1GnLBciOIDxuLj6lhZVA/watch',
    imageUrl: '/images/retreats/retreats-7.webp',
    imageAlt: 'Bathing at the waterfall',
    imageAltEs: 'Baño en la cascada',
    labelEs: 'Retiro transformacional',
    descriptionEs:
      'Más que un retiro: un despertar. Para quien busca una experiencia que sacuda su mundo y le devuelva la energía del HELL YES.',
  }),
];
