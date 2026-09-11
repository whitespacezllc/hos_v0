import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { FONT_VARIABLES } from '@/lib/fonts';
import { BUSINESS } from '@/lib/business';
import { SITE_ICONS } from '@/lib/seo';
import '@/app/globals.css';

// ─── Document shell for the admin panel and the instructor portal ───────────
// Both live outside app/[locale] — the admin's language is a preference, not a
// URL (see lib/admin-locale.ts) — so neither is wrapped by the public site's
// root layout, and each needs a root layout of its own with `<html>` and
// `<body>`. This is that shell, shared so the fonts, the global stylesheet and
// the favicon set are declared in one place.
//
// Deliberately less than the public document: no splash, no skip link, no
// WhatsApp tile, no Cloudbeds loaders. None of those belong on a dashboard.

/** Metadata every backoffice root layout spreads into its own. */
export const BACKOFFICE_METADATA = {
  metadataBase: new URL(BUSINESS.url),
  icons: SITE_ICONS,
} satisfies Metadata;

export function BackofficeDocument({ children, lang = 'en' }: { children: React.ReactNode; lang?: string }) {
  return (
    <html lang={lang} className={FONT_VARIABLES}>
      <body className="font-body antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
