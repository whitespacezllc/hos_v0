// ─── Google Tag Manager ──────────────────────────────────────────────────────
// The container the ads side runs (Google Ads conversions and GA4 are
// configured inside GTM, not here). This is Google's current install code,
// verbatim: one async loader plus the dataLayer/gtag stub, as high in <head>
// as possible, once per page. The older two-part snippet with a <noscript>
// iframe in <body> is no longer part of it.
//
// Rendered by the public root layout only — app/[locale]/layout.tsx — so
// every page a guest can reach carries it, /book included (the Cloudbeds
// engine runs inside that page). The admin panel and the instructor portal
// have their own root layouts and stay untagged on purpose.
//
// Production only: local dev and Vercel previews would otherwise send page
// views from localhost and *.vercel.app into the same GA4 property.
//
// ─── The Google Ads `config` line, and why the booking needs it ─────────────
// The booking conversion is fired by Cloudbeds, not by us: when a reservation
// is created, the Immersive Experience calls
// gtag('event', 'conversion', { send_to: '<id>/<label>', value, transaction_id… })
// on this page, with the conversion ID and label loaded in Cloudbeds →
// Settings → Booking Engine → Analytics. But it only does so if this page's
// dataLayer already holds a gtag('config', '<that same id>') — its own check,
// read from their bundle (the `ql` guard in index13.chunk.js, Nov 2026). The
// Ads tag living inside the GTM container does not leave that entry in the
// dataLayer, so without the line below the conversion never fires.
//
// `send_page_view: false` because the Google tag in GTM already sends the
// page view to this account; the line exists to pass Cloudbeds' check and to
// route the conversion, not to count visits twice. The ID must match the one
// in Cloudbeds character for character, AW- prefix included.

export const GTM_ID = 'GTM-5VWZBWCM';
export const GOOGLE_ADS_ID = 'AW-18552728484';

const GTM_STUB =
  "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());" +
  `gtag('config', '${GOOGLE_ADS_ID}', { send_page_view: false });`;

export function GoogleTagManager() {
  if (process.env.VERCEL_ENV !== 'production') return null;

  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} />
      <script dangerouslySetInnerHTML={{ __html: GTM_STUB }} />
    </>
  );
}
