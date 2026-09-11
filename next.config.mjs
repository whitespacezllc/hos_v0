import createNextIntlPlugin from 'next-intl/plugin';

// Wires i18n/request.ts into the build so every server render knows its
// locale and messages. The path is explicit rather than the plugin's default
// lookup, so a move of the folder fails loudly instead of silently rendering
// without messages.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// ─── The old domain ──────────────────────────────────────────────────────────
// houseofshaktiyoga.com was the Wix site. Its DNS points at this project now,
// so every request that arrives on that host — www or bare — must leave with
// a 301 to the same page on houseofshakticr.com, and the new site's content
// must never be served under the old name.
//
// Page by page, not everything to the home: a blanket redirect reads to Google
// as a soft 404 and discards whatever authority the inner pages had earned.
// The host condition is on every rule, so houseofshakticr.com is untouched.
// Wix canonicalised to www, so that is the indexed form, but people type the
// bare domain too; the regex takes both.
const OLD_HOST = { type: 'host', value: '(?:www\\.)?houseofshaktiyoga\\.com' };
const NEW_ORIGIN = 'https://houseofshakticr.com';

/**
 * A 301 from a path on the old host to a path on the new one. An explicit
 * `statusCode` rather than `permanent: true`, because Next spells "permanent"
 * as 308 and a domain move wants the plain 301 every crawler and every old
 * HTTP client already understands. Both are permanent to Google; 301 is the
 * one the migration was specified and will be verified against.
 */
const fromOldDomain = (source, path) => ({
  source,
  destination: `${NEW_ORIGIN}${path}`,
  statusCode: 301,
  has: [OLD_HOST],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // "Accommodations" became "Stay With Us" before launch, so there is no
      // search equity behind the old path — but preview links have already been
      // shared, and the owners have sent the old URL by hand. A permanent
      // redirect costs nothing and saves every one of those.
      { source: '/accommodations', destination: '/stay-with-us', permanent: true },
      // The gallery became the About page: the photographs are on every other
      // page already, and what the site lacked was the words. The old path
      // stays reachable for the links that went out with it.
      { source: '/gallery', destination: '/about', permanent: true },

      // ── houseofshaktiyoga.com → houseofshakticr.com ────────────────────────
      // First match wins: the named pages come first, the wildcards after,
      // and the path-preserving catch-all last.

      // Pages whose name changed.
      fromOldDomain('/santa-teresa-yoga-classes', '/yoga'),
      fromOldDomain('/yoga-and-breathwork', '/yoga'),
      fromOldDomain('/online-yoga', '/yoga'),
      fromOldDomain('/book-yoga-classes', '/yoga'),
      fromOldDomain('/embody-yoga-teacher-training', '/yoga-teacher-training'),
      fromOldDomain('/ytt-teaching-team', '/yoga-teacher-training'),
      // Wix's own typo, kept as is: that is the URL Google indexed.
      fromOldDomain('/accomodations-santa-teresa-costa-rica', '/stay-with-us'),

      // The blog did not come across. Each post goes to its nearest topic.
      fromOldDomain('/post/yoga-teacher-training-your-path-to-empowerment', '/yoga-teacher-training'),
      fromOldDomain('/post/:slug*', '/yoga'),
      fromOldDomain('/blog', '/yoga'),
      fromOldDomain('/blog/:path*', '/yoga'),

      // Wix Bookings. Three services have a page of their own on the new site
      // and must sit before the wildcard; the rest of the booking machinery
      // lands on the yoga page.
      fromOldDomain('/booking-calendar/house-of-shakti-experience-1', '/shakti-experience'),
      fromOldDomain('/booking-calendar/shakti-sadhana-1', '/retreats/shakti-sadhana'),
      fromOldDomain('/booking-calendar/other-retreats', '/retreats'),
      fromOldDomain('/booking-calendar/:path*', '/yoga'),
      fromOldDomain('/service-page/:path*', '/yoga'),
      fromOldDomain('/bookings-checkout/:path*', '/yoga'),
      fromOldDomain('/account/:path*', '/'),

      // Everything else keeps its path: /about, /retreats, /contact and any
      // route that exists under the same name on both sites. A path the new
      // site does not have gets a real 404 there, which is the right answer.
      // The home is spelled out because `:path*` with nothing captured
      // compiles to the bare origin, and the redirect should say `/`.
      fromOldDomain('/', '/'),
      fromOldDomain('/:path*', '/:path*'),
    ]
  },
  async headers() {
    // Static media is served with `public, max-age=0, must-revalidate` by
    // default, so every repeat visit revalidates every file. Vercel's edge
    // answers quickly, but that is still one round trip per asset, and a page
    // here carries a hero clip, its poster and a few dozen photographs.
    //
    // A day of freshness, then a month of serving the cached copy while a new
    // one is fetched behind it. Deliberately not `immutable`: assets here get
    // replaced under the same filename, and a year-long pin would strand
    // returning visitors on an old cut of a video with no way to recover.
    return [
      {
        source: '/:all*(mp4|webm|jpg|jpeg|png|webp|svg|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=2592000',
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
