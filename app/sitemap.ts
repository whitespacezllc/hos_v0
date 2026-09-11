import type { MetadataRoute } from 'next';
import { ACTIVE_LOCALES, canonicalUrl, languageAlternates } from '@/lib/seo';
import { listRetreatSlugs } from '@/lib/retreats';

// ─── Sitemap ─────────────────────────────────────────────────────────────────
// The public site only, in both languages. Everything behind auth, every API
// handler, the booking flow and the two 308 redirects configured in
// next.config.mjs are left out: a sitemap that lists a redirect asks a crawler
// to spend budget discovering it is a redirect.
//
// Deliberately excluded, and why:
//   /admin/*, /instructor/*  — private, and blocked in robots.ts
//   /api/*                   — not pages
//   /booking/*               — a transactional flow, no standalone value
//   /paquetes/resultado      — a post-payment receipt, per-visitor
//   /clases                  — redirect('/yoga')
//   /gallery, /accommodations — 308 redirects
//
// Every page appears once per locale — `/yoga` and `/es/yoga` — and each entry
// names its alternates, the same hreflang set the page itself emits, so a
// crawler learns the pairing from the sitemap as well as from the markup.

type Entry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

const ROUTES: Entry[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  // The class schedule is regenerated from the recurring templates every week.
  { path: '/yoga', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/stay-with-us', changeFrequency: 'monthly', priority: 0.8 },
  // The rooms' booking page. The engine inside it renders in the browser, but
  // the page is a real, permanent destination — "book a room at House of
  // Shakti" should resolve to it.
  { path: '/book', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/retreats', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/shakti-experience', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/host-your-retreat', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/yoga-teacher-training', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/upcoming-retreats', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/about', changeFrequency: 'yearly', priority: 0.6 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.6 },
  { path: '/paquetes', changeFrequency: 'monthly', priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // The moment this build ran. On Vercel a git checkout resets every file's
  // mtime, so reading the source files would report the same thing less
  // honestly. What this actually claims — "the static HTML was regenerated
  // then" — is true.
  const lastModified = new Date();

  const entries: Entry[] = [
    ...ROUTES,
    ...listRetreatSlugs().map((slug) => ({
      path: `/retreats/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];

  return entries.flatMap((route) =>
    ACTIVE_LOCALES.map((locale) => ({
      url: canonicalUrl(route.path, locale),
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: { languages: languageAlternates(route.path) },
    })),
  );
}
