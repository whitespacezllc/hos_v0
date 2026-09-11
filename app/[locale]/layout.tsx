import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { SHARED_NAMESPACES, pickMessages } from '@/i18n/messages'
import { Analytics } from '@vercel/analytics/next'
import { routing, localeFromParams, type LocaleParams } from '@/i18n/routing'
import { FONT_VARIABLES } from '@/lib/fonts'
import { SplashScreen } from '@/components/landing/SplashScreen'
import { WhatsAppButton } from '@/components/landing/WhatsAppButton'
import { BUSINESS } from '@/lib/business'
import { DEFAULT_OG_IMAGE, SITE_ICONS, openGraphLocale } from '@/lib/seo'
import '../globals.css'

// ─── Root layout of the public site ──────────────────────────────────────────
// One of three root layouts: this one serves everything a guest can reach, in
// both languages, at `/…` and `/es/…`. The admin panel and the instructor
// portal have their own (app/admin, app/instructor), because they live
// outside the locale segment — there is no /es/admin — and a root layout is
// the only place `<html lang>` can be set from the route.
//
// Both locales are pre-rendered at build time. `setRequestLocale` is what
// makes that possible: it hands the segment's locale to next-intl before
// anything reads it, so no request header has to be consulted and the page
// stays static. Every page under this layout calls it too.

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await localeFromParams(params)

  return {
    // Every relative URL in metadata — canonicals, Open Graph images — resolves
    // against this. Without it Next emits relative OG URLs, which most scrapers
    // simply drop.
    metadataBase: new URL(BUSINESS.url),

    // `%s` is whatever a page passes as its title; the home page opts out with
    // `absolute`. Set here so no page has to repeat the brand.
    title: {
      template: '%s | House of Shakti',
      default: 'House of Shakti — Yoga Sanctuary in Santa Teresa, Costa Rica',
    },
    description: BUSINESS.description,

    // Defaults for any page that doesn't build its own through lib/seo.ts.
    openGraph: {
      type: 'website',
      siteName: BUSINESS.name,
      ...openGraphLocale(locale),
      url: BUSINESS.url,
      title: 'House of Shakti — Yoga Sanctuary in Santa Teresa, Costa Rica',
      description: BUSINESS.description,
      images: [
        {
          url: DEFAULT_OG_IMAGE.url,
          alt: DEFAULT_OG_IMAGE.alt,
          width: DEFAULT_OG_IMAGE.width,
          height: DEFAULT_OG_IMAGE.height,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'House of Shakti — Yoga Sanctuary in Santa Teresa, Costa Rica',
      description: BUSINESS.description,
      images: [DEFAULT_OG_IMAGE.url],
    },

    // Explicit rather than implied. The `googleBot` block lifts the caps on
    // snippet length and image preview size, which is what lets a rich result
    // show a real photograph of the property instead of a thumbnail.
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },

    // Google Search Console's meta-tag verification. Rendered only when the
    // variable is set, so nothing appears in the markup until the property is
    // actually being claimed. Next drops the whole `verification` block when
    // `google` is undefined.
    ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION
      ? { verification: { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } }
      : {}),

    icons: SITE_ICONS,
  }
}

export default async function RootLayout({ children, params }: LocaleParams & { children: React.ReactNode }) {
  const { locale } = await params
  // The proxy only ever routes here with one of our locales; anything else is
  // a direct hit on the segment and is not a page.
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  // Only the chrome every page shares goes to the client from here — the
  // navigation, the footer, the WhatsApp tile. Each page adds its own
  // namespace through PageMessages, so nobody downloads the whole catalogue.
  const messages = pickMessages(await getMessages(), SHARED_NAMESPACES)
  const t = await getTranslations('common.labels')

  return (
    <html lang={locale} className={FONT_VARIABLES}>
      <body className="font-body antialiased">
        {/* Pre-paint splash decision. An inline synchronous script blocks the
            parser for microseconds and runs BEFORE anything below it paints —
            the only place the sessionStorage + reduced-motion call can be made
            without flashing the SSR'd veil at returning visitors while the
            bundle hydrates. It stamps <html data-splash="play"> only when the
            splash should run; the CSS gate in globals.css keeps the overlay
            display:none otherwise, so no JS (or a failed bundle) degrades to
            no splash instead of a page covered forever. Writing the seen-key
            here — once per load, outside React — is also what lets the
            component's own effect stay a pure read, immune to StrictMode's
            double-invoke in dev. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var k='hos-splash-seen';if(sessionStorage.getItem(k)!=='1'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.dataset.splash='play';sessionStorage.setItem(k,'1')}}catch(e){}",
          }}
        />
        {/* Skip to content — invisible until focused, which for a keyboard
            user is the first stop on every page. Without it, reaching the
            article means tabbing past the menu, the logo, the language pair
            and the booking CTA on every single navigation. `sr-only` plus
            `focus:not-sr-only` is the standard pair; the styling matches the
            site's own CTAs so it doesn't look like a browser artefact when it
            appears. Every page's <main> carries id="main-content". */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-dark focus:text-cream focus:font-body focus:text-sm focus:tracking-[0.05em] focus:px-6 focus:py-3"
        >
          {t('skipToContent')}
        </a>
        <SplashScreen />
        {/* The locale is inherited from i18n/request.ts. Every `useLocale()`
            and `useTranslations()` in the shared chrome reads from here. */}
        <NextIntlClientProvider messages={messages}>
          {children}
          {/* Floating WhatsApp entry point — every public page; the component
              itself stays out of /login and /booking. */}
          <WhatsAppButton />
        </NextIntlClientProvider>
        <Analytics />
        {/* No Cloudbeds script here: the booking engine loads on /book alone
            (components/booking-engine/CloudbedsImmersive.tsx), and every
            other page only links there. */}
      </body>
    </html>
  )
}
