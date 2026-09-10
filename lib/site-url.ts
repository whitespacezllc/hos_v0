import { BUSINESS } from '@/lib/business';

// ─── Where this deployment lives ─────────────────────────────────────────────
// Tilopay has to send the customer back to an absolute URL, and the payment
// callback redirects to the receipt on the same origin. Before this existed
// the fallback was `http://localhost:3000` — one unset variable away from a
// live card payment returning to nowhere.
//
// Order of trust: an explicit NEXT_PUBLIC_SITE_URL wins; production on Vercel
// is the canonical domain; a preview deployment is its own URL; anything else
// is local development.
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  if (process.env.VERCEL_ENV === 'production') return BUSINESS.url;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
