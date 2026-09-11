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
// The hosted engine at hotels.cloudbeds.com, carrying the same search, stays
// at the foot as a quiet second door. A network that blocks
// static1.cloudbeds.com, a domain Cloudbeds has not yet whitelisted, or a
// script that fails to load would otherwise leave a guest with no way to book.
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
          <HostedDoorWithSearch tone="alert" lead={t('failed')} />
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

      {!failed && <HostedDoorWithSearch tone="quiet" lead={t('hosted.lead')} />}
    </div>
  );
}

// ─── The second door ─────────────────────────────────────────────────────────
// One line with a link to the hosted engine. `quiet` is the standing note at
// the foot of the page; `alert` replaces the engine when its script never
// arrived, and is announced as such.
function HostedDoor({ tone, lead, search }: { tone: 'quiet' | 'alert'; lead: string; search?: BookingSearch }) {
  const t = useTranslations('book');
  return (
    <p
      role={tone === 'alert' ? 'alert' : undefined}
      className={
        tone === 'alert'
          ? 'font-body text-sm text-ink text-center pt-16'
          : 'font-body text-xs text-ink/60 text-center mt-12'
      }
    >
      {lead}{' '}
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
// URL, which is what the server renders and what stands for the instant
// before the client fills the dates in.
function HostedDoorWithSearch(props: { tone: 'quiet' | 'alert'; lead: string }) {
  return (
    <Suspense fallback={<HostedDoor {...props} />}>
      <HostedDoorFromUrl {...props} />
    </Suspense>
  );
}

function HostedDoorFromUrl(props: { tone: 'quiet' | 'alert'; lead: string }) {
  const params = useSearchParams();
  return <HostedDoor {...props} search={bookingSearchFromParams(params)} />;
}
