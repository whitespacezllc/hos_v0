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

export const GTM_ID = 'GTM-5VWZBWCM';

const GTM_STUB =
  "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());";

export function GoogleTagManager() {
  if (process.env.VERCEL_ENV !== 'production') return null;

  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} />
      <script dangerouslySetInnerHTML={{ __html: GTM_STUB }} />
    </>
  );
}
