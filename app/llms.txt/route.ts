import { BUSINESS } from '@/lib/business';
import { getStays } from '@/lib/stays';
import { CLOUDBEDS_HOSTED_URL } from '@/lib/cloudbeds';

// ─── /llms.txt ───────────────────────────────────────────────────────────────
// The short card for language models (llmstxt.org): who the house is, what
// it offers, where each thing lives on the site, how to reach the team. The
// full text of the site is at /llms-full.txt. Built from the same constants
// the pages use, so the domain, the number and the addresses can't drift.

export const dynamic = 'force-static';

const PAGES: [string, string][] = [
  ['/', 'overview'],
  ['/yoga', 'class schedule, class packs, special activities and booking'],
  ['/stay-with-us', 'the places to stay, with photographs'],
  ['/book', 'live availability, rates and booking for the rooms (the Cloudbeds booking engine, in the page)'],
  ['/retreats', 'retreats hosted by House of Shakti'],
  ['/upcoming-retreats', 'upcoming and past retreats by visiting facilitators, with dates and links'],
  ['/yoga-teacher-training', 'the 100-hour Tantra yoga teacher training (Yoga Alliance RYT 200)'],
  ['/shakti-experience', 'packaged stays: a week, a few days, or your own'],
  ['/host-your-retreat', 'private hire of the property for groups, and a quote form'],
  ['/about', 'the house and its founder, Nancy Goodfellow'],
  ['/contact', 'how to reach the team'],
];

export function GET() {
  const stays = getStays('en');
  const lines = [
    `# ${BUSINESS.name}`,
    '',
    `> ${BUSINESS.description}`,
    '',
    `Canonical site: ${BUSINESS.url} (English). Every page has a Spanish twin under ${BUSINESS.url}/es — for example /es/yoga — linked through hreflang. The full text of the site, in one file: ${BUSINESS.url}/llms-full.txt`,
    '',
    '## What it offers',
    '',
    '- Daily yoga classes in an open-air shala, open to all levels, bookable per class or as a class pack.',
    '- Yoga retreats hosted by House of Shakti, and retreats hosted by visiting facilitators from around the world.',
    '- A 100-hour Tantra yoga teacher training leading to Yoga Alliance RYT 200.',
    '- The Shakti Experience: a packaged stay of a week, a few days, or a length and set of activities chosen by the guest.',
    '- Private hire of the whole property for groups hosting their own retreat.',
    `- On site: ${BUSINESS.amenities.map((a) => a.toLowerCase()).join(', ')}.`,
    '',
    '## Where guests sleep',
    '',
    ...stays.map((s) => `- ${s.title} — ${s.meta}`),
    '',
    '## Booking',
    '',
    `Accommodation is booked at ${BUSINESS.url}/book, where the Cloudbeds booking engine runs inside the site (the same engine as Cloudbeds hosts it: ${CLOUDBEDS_HOSTED_URL}). Yoga classes and class packs are booked on the site. Retreats, teacher trainings and private group hire are arranged over WhatsApp at ${BUSINESS.phoneDisplay}.`,
    '',
    '## Pages',
    '',
    ...PAGES.map(([path, what]) => `- ${BUSINESS.url}${path === '/' ? '/' : path} — ${what}`),
    '',
    '## Contact',
    '',
    `- WhatsApp and phone: ${BUSINESS.phoneDisplay} (${BUSINESS.whatsappUrl})`,
    `- Email, stays and general questions: ${BUSINESS.email.general}`,
    `- Email, yoga classes and packs: ${BUSINESS.email.yogaStudio}`,
    `- Email, retreats and hosting one: ${BUSINESS.email.retreats}`,
    `- Email, press and media: ${BUSINESS.email.media}`,
    `- Instagram: ${BUSINESS.instagram}`,
    `- Location: ${BUSINESS.addressLines.slice(1).join(', ')} — ${BUSINESS.geo.latitude}, ${BUSINESS.geo.longitude} (${BUSINESS.googleMapsUrl})`,
    `- Reception: every day ${BUSINESS.openingHours.opens}–${BUSINESS.openingHours.closes} (Costa Rica, UTC−6)`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
