import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/business';
import { ACTIVE_LOCALES, localizedPath } from '@/lib/seo';

// ─── robots.txt ──────────────────────────────────────────────────────────────
// Two audiences, both wanted.
//
// Search crawlers get the whole public site and nothing else: the admin, the
// instructor portal, the API handlers, the booking flow and the per-visitor
// payment receipt are all off limits — not because they are secret (auth
// handles that) but because they are worthless in an index and would burn
// crawl budget.
//
// Answer engines are allowed on purpose. A guest planning a trip increasingly
// asks an assistant "where should I do yoga in Santa Teresa" rather than a
// search box, and for a house this small, being in that answer is worth more
// than a rank. The crawlers behind the main assistants are named explicitly
// so the permission survives any future default-deny: OpenAI's training and
// search bots, Anthropic's, Perplexity's, Google's and Apple's. /llms.txt and
// /llms-full.txt are written for them.
const PRIVATE_PATHS = [
  '/admin',
  '/instructor',
  '/api',
  // Public-site paths exist in every language: `/booking` and `/es/booking`.
  ...['/booking', '/paquetes/resultado', '/login', '/forgot-password', '/set-password'].flatMap((path) =>
    ACTIVE_LOCALES.map((locale) => localizedPath(path, locale)),
  ),
];

const ANSWER_ENGINES = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      ...ANSWER_ENGINES.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
