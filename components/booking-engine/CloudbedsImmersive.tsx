'use client';

import { Suspense, useState } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  CLOUDBEDS_HOSTED_URL,
  CLOUDBEDS_IMMERSIVE_SCRIPT_SRC,
  CLOUDBEDS_PROPERTY_CODE,
  bookingSearchFromParams,
  cloudbedsHostedUrl,
  type BookingSearch,
} from '@/lib/cloudbeds';

// ─── The booking engine, in the page ─────────────────────────────────────────
// Cloudbeds' Immersive Experience 2.0 in its standard mode. The element below
// is the whole flow — dates, rooms, extras, guest, payment — rendered by
// Cloudbeds' script into our page, styled by them, scoped under
// `.cb-bookingengine-root`. Only /book mounts this, so only /book pays for the
// script (1.3 MB); the rest of the site links here. See lib/cloudbeds.ts.
//
// The script is loaded here, not in the root <head> Cloudbeds' guide shows,
// for one reason: on a Next site every page shares that head, and nothing
// outside this page needs the engine. The element is already in the HTML when
// the script arrives — it is server-rendered — and a custom element defined
// after the fact upgrades in place; that is what custom elements are for.
// Everything the engine needs from us it reads from the page itself: the
// query string (checkin, checkout, adults…) and, as a fallback for `lang`,
// <html lang>.
//
// The property's own header and footer from the Cloudbeds panel are hidden:
// they were written for the hosted page, and here the site's navigation and
// footer already frame the engine.
//
// The hosted engine at hotels.cloudbeds.com appears only when the script
// itself never arrives — a network that blocks static1.cloudbeds.com, an
// extension — and would otherwise leave a guest with no way to book. With the
// engine on the page there is no second door: the owners asked for one way
// in, and a standing "or book on Cloudbeds' page" under the engine read as a
// doubt about the one above it.
export function CloudbedsImmersive() {
  const locale = useLocale();
  const t = useTranslations('book');
  const [failed, setFailed] = useState(false);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
      <Script src={CLOUDBEDS_IMMERSIVE_SCRIPT_SRC} strategy="afterInteractive" onError={() => setFailed(true)} />

      {/* A floor under the engine while the script is on its way, so the
          footer does not sit up here and then drop as the flow appears. */}
      <div className="min-h-[60vh]">
        {failed ? (
          <HostedDoorWithSearch />
        ) : (
          <cb-immersive-experience
            mode="standard"
            property-code={CLOUDBEDS_PROPERTY_CODE}
            lang={locale}
            hide-custom-header="yes"
            hide-custom-footer="yes"
          />
        )}
        <noscript>
          <p className="font-body text-sm text-ink text-center pt-16">
            {t('failed')} <a href={CLOUDBEDS_HOSTED_URL}>{t('hosted.link')}</a>
          </p>
        </noscript>
      </div>
    </div>
  );
}

// ─── The door of last resort ─────────────────────────────────────────────────
// Replaces the engine when its script never arrived, and is announced as
// such: one line, and a link to the hosted engine.
function HostedDoor({ search }: { search?: BookingSearch }) {
  const t = useTranslations('book');
  return (
    <p role="alert" className="font-body text-sm text-ink text-center pt-16">
      {t('failed')}{' '}
      <a
        href={cloudbedsHostedUrl(search)}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300"
      >
        {t('hosted.link')}
      </a>
    </p>
  );
}

// The search the reader arrived with rides along to the hosted page, so it
// opens on their dates too. `useSearchParams` is Next's own view of the URL —
// current from the first render after a client-side navigation, which a read
// of window.location during render would not be. On a static page it asks
// for a Suspense boundary; the fallback is the same line with the bare hosted
// URL, standing in for the instant before the client fills the dates in.
function HostedDoorWithSearch() {
  return (
    <Suspense fallback={<HostedDoor />}>
      <HostedDoorFromUrl />
    </Suspense>
  );
}

function HostedDoorFromUrl() {
  const params = useSearchParams();
  return <HostedDoor search={bookingSearchFromParams(params)} />;
}
