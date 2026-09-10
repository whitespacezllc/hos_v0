// ─── House of Shakti — the business, in one place ────────────────────────────
// Every part of the site that states a fact about the business reads it from
// here: the footer, the contact page, the calendar invitations, the outgoing
// email, the sitemap, and — most consequentially — the structured data we
// hand to search engines.
//
// Before this existed the address was typed out three times by hand and the
// email domain disagreed with itself (`houseofshaktiyoga.com` on the contact
// page, `houseofshakti.com` in the ICS builder). Structured data makes that
// kind of drift expensive: a search engine that reads two different addresses
// for one business trusts neither.
//
// Every value here was confirmed by the owners on 2026-09-07, with one
// exception noted below. Nothing in this file is a guess.

import { WHATSAPP_NUMBER, WHATSAPP_URL_PLAIN } from '@/lib/whatsapp';

/** Geographic coordinates, as read off the property. */
export type Geo = { latitude: number; longitude: number };

export const BUSINESS = Object.freeze({
  name: 'House of Shakti',

  /** The full name the Google Business profile is registered under. */
  alternateName: 'House of Shakti Sanctuary, Retreats & Yoga studio',

  // TODO_CONFIRM: the registered legal entity, if it differs from the trading
  // name. The only value still outstanding; omitted from JSON-LD while null.
  legalName: null as string | null,

  /**
   * Canonical production origin. No trailing slash, no `www`.
   *
   * houseofshakticr.com since launch night (2026-09-10); houseofshaktiyoga.com
   * was the working name until then and never went live. Every canonical,
   * alternate, sitemap entry, JSON-LD @id and llms.txt link derives from
   * this one value — change it here and nowhere else.
   */
  url: 'https://houseofshakticr.com',

  description:
    'House of Shakti is a yoga sanctuary and boutique retreat house in Santa Teresa, Costa Rica, offering daily yoga classes, retreats, teacher trainings and jungle accommodation five minutes from Playa Hermosa.',

  address: Object.freeze({
    // A Google plus code rather than a street name — Santa Teresa is addressed
    // by landmark, and this is the precise, resolvable form.
    street: 'MRCG+34',
    // The plus code resolves administratively to "Santiago", but nobody
    // searches for that: the house is known, found and booked as Santa Teresa.
    // The locality is deliberately the searchable name, not the cadastral one.
    locality: 'Santa Teresa',
    region: 'Puntarenas',
    // No postal code exists for this address — the field is absent rather than
    // empty, so nothing downstream has to decide what a blank one means.
    /** ISO 3166-1 alpha-2. */
    country: 'CR',
    countryName: 'Costa Rica',
  }),

  // The single line the site has always shown, kept verbatim so the footer and
  // the contact page render exactly as before.
  addressLines: Object.freeze(['House of Shakti', 'Santa Teresa', 'Puntarenas, Costa Rica']),

  /** Derived from lib/whatsapp.ts — the one number the whole site dials. */
  phone: `+${WHATSAPP_NUMBER}`,
  phoneDisplay: '+506 8560 5115',
  whatsappUrl: WHATSAPP_URL_PLAIN,

  // The mailboxes as the owners confirmed them; they live on the
  // houseofshaktiyoga.com mail domain, which is separate from the website's.
  // Change these only once the owners say the addresses themselves moved.
  email: Object.freeze({
    general: 'hello@houseofshaktiyoga.com',
    retreats: 'retreats@houseofshaktiyoga.com',
    press: 'press@houseofshaktiyoga.com',
  }),

  instagram: 'https://www.instagram.com/house.of.shakti/',
  instagramHandle: '@house.of.shakti',

  /**
   * The Google Business profile.
   *
   * This is a *place* link, not a search query — it resolves to one listing and
   * only that listing. It belongs in schema.org's `hasMap`, which exists for
   * exactly this, and not in `sameAs`: `sameAs` is for profiles that represent
   * the business's own identity elsewhere, and a map pin is a location, not an
   * identity.
   */
  googleMapsUrl:
    'https://www.google.com/maps/place/House+of+Shakti+Sanctuary,+Retreats+%26+Yoga+studio/@9.6701384,-85.1747111,21z/data=!4m9!3m8!1s0x8f9f6f548041a59b:0x69586416c9cba625',

  /** Google's internal place identifier. Kept for the Business Profile API; no schema.org field maps to it. */
  googleMapsPlaceIdHex: '0x8f9f6f548041a59b:0x69586416c9cba625',

  geo: Object.freeze({ latitude: 9.6701506, longitude: -85.1746391 }) as Geo,

  /** Price band for LodgingBusiness. */
  priceRange: '$$$',

  /** Reception hours: every day, 09:00–17:00. */
  openingHours: Object.freeze({
    days: Object.freeze([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]),
    opens: '09:00',
    closes: '17:00',
  }),

  /** What the house actually has. Feeds `amenityFeature`. */
  amenities: Object.freeze([
    'Yoga shala',
    'Ice bath',
    'Sauna',
    'Saltwater pool',
    'Jungle setting',
    'High-speed Wi-Fi',
    'Air conditioning',
  ]),

  /** Profiles we can prove are ours. Only add links that resolve. */
  sameAs: Object.freeze(['https://www.instagram.com/house.of.shakti/']),
});

/** Absolute URL for a site-relative path. Used by metadata, sitemap and schema. */
export function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${BUSINESS.url}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The canonical mail host, for anything that has to build an address. */
export const EMAIL_DOMAIN = 'houseofshaktiyoga.com';
