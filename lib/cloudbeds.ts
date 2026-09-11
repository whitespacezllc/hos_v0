// ─── Cloudbeds — Immersive Experience 2.0 ────────────────────────────────────
// The rooms are sold through Cloudbeds. Since Booking Engine Plus, the way
// Cloudbeds supports putting the engine on a property's own site is the
// Immersive Experience 2.0: one script from static1.cloudbeds.com and a web
// component, <cb-immersive-experience>, that renders the whole flow — dates,
// rooms, extras, guest details, payment — inside our page, with no iframe.
// The per-property loader this site used before
// (us2.cloudbeds.com/widget/load/…/immersive) was the iframe-era popup; it
// went with the legacy engine in Q1 2026 and nothing here calls it any more.
//
// Where it lives: /book and /es/book (app/[locale]/book), in the engine's
// "standard" mode — the full page, not the slide-in overlay. Every "Reserve"
// and "Check availability" on the site is a plain link there.
//
// Two things Cloudbeds needs from the property, neither of them in code:
//   • Our domains whitelisted under Settings → Booking Engine → Embeds →
//     Premium → Immersive Experience 2.0 → Whitelisted domains. The component
//     calls Cloudbeds' API from our origin, and an origin not on that list is
//     refused. docs/cloudbeds.md carries the list and the rest of the setup.
//   • Premium Embeds on the subscription — the same screen says whether it is.
//
// Docs: https://myfrontdesk.cloudbeds.com/hc/en-us/articles/32048321731739

/**
 * The public six-character property code — the tail of the hosted engine's
 * URL. An identifier, not a credential.
 */
export const CLOUDBEDS_PROPERTY_CODE = 'zE6Wy8';

/**
 * The Immersive Experience 2.0 bundle. One URL for every property; `latest`
 * is Cloudbeds' to move, and they do.
 */
export const CLOUDBEDS_IMMERSIVE_SCRIPT_SRC =
  'https://static1.cloudbeds.com/booking-engine/latest/static/js/immersive-experience/cb-immersive-experience.js';

/** The engine as Cloudbeds hosts it — the door that stays open if the script cannot run here. */
export const CLOUDBEDS_HOSTED_URL = `https://hotels.cloudbeds.com/reservation/${CLOUDBEDS_PROPERTY_CODE}`;

/** The page that embeds the engine. Locale-less; i18n's `Link` adds `/es`. */
export const BOOK_PATH = '/book';

/**
 * What a link into the engine can pre-fill. The component reads these from
 * the page's own query string when it starts — the same names the hosted
 * engine takes — so `/book?checkin=…&checkout=…` opens on that stay. Read
 * once, on mount; a change to the URL afterwards is not seen.
 *
 * Dates are `YYYY-MM-DD`. A checkin without a checkout gets the next day.
 */
export type BookingSearch = {
  checkin?: string;
  checkout?: string;
  adults?: number;
  kids?: number;
  promo?: string;
};

const SEARCH_KEYS = ['checkin', 'checkout', 'adults', 'kids', 'promo'] as const;

function searchString(search?: BookingSearch): string {
  if (!search) return '';
  const params = new URLSearchParams();
  for (const key of SEARCH_KEYS) {
    const value = search[key];
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** The pre-fill a page arrived with, so it can be carried on to the hosted engine. */
export function bookingSearchFromParams(params: URLSearchParams): BookingSearch {
  const search: BookingSearch = {};
  const checkin = params.get('checkin');
  const checkout = params.get('checkout');
  const promo = params.get('promo');
  const adults = Number(params.get('adults'));
  const kids = Number(params.get('kids'));
  if (checkin) search.checkin = checkin;
  if (checkout) search.checkout = checkout;
  if (promo) search.promo = promo;
  if (Number.isInteger(adults) && adults > 0) search.adults = adults;
  if (Number.isInteger(kids) && kids > 0) search.kids = kids;
  return search;
}

/** `/book`, with the stay to pre-fill when there is one. */
export function bookHref(search?: BookingSearch): string {
  return `${BOOK_PATH}${searchString(search)}`;
}

/** The hosted engine, with the same pre-fill. */
export function cloudbedsHostedUrl(search?: BookingSearch): string {
  return `${CLOUDBEDS_HOSTED_URL}${searchString(search)}`;
}
