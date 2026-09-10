import { siteOrigin } from '@/lib/site-url';

// ─── Where Tilopay sends the customer back ───────────────────────────────────
// The hosted payment page returns to one URL, our callback, with the result in
// the query string. The callback then sends the customer on to the receipt in
// the language they paid in — which is stored on the order itself (migration
// 009), so nothing has to ride the return URL. Keeping it bare also avoids
// betting on how Tilopay merges its parameters into a URL that already has
// some.
export function tilopayReturnUrl(): string {
  return new URL('/api/tilopay/callback', siteOrigin()).toString();
}
