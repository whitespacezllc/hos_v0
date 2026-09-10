import en from '@/messages/en.json';
import { BUSINESS } from '@/lib/business';
import { getStays } from '@/lib/stays';
import { getRetreatBySlug, listRetreatSlugs, type Retreat } from '@/lib/retreats';
import { getPublishedRetreatListings } from '@/lib/queries/retreatListings';
import {
  SEED_RETREAT_LISTINGS,
  formatRetreatDates,
  isSitePath,
  splitRetreatListings,
  todayInCostaRica,
} from '@/lib/retreat-listings';

// ─── /llms-full.txt ──────────────────────────────────────────────────────────
// The whole public site as one plain-text document, for the language models
// that answer "where should I do yoga in Santa Teresa": every fact the pages
// state, in the pages' own words, drawn from the same catalogue and the same
// tables the pages render from. Rebuilt every hour, so a retreat added in
// the panel is here within the hour.
//
// English only: it is the site's canonical language, and a model that reads
// one language well reads the other. The Spanish pages remain linked.

export const revalidate = 3600;

const H = (level: number, text: string) => `${'#'.repeat(level)} ${text}`;
const bullets = (items: readonly string[]) => items.map((i) => `- ${i}`).join('\n');
const titled = (items: Record<string, { title: string; description: string; note?: string }>) =>
  bullets(Object.values(items).map((i) => `${i.title} — ${i.description}${i.note ? ` (${i.note})` : ''}`));
const faq = (items: { question: string; answer: string }[]) =>
  items.map((i) => `**${i.question}**\n${i.answer}`).join('\n\n');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function retreatBlock(r: Retreat): string {
  const dates = r.startDate && r.endDate ? formatRetreatDates(r.startDate, r.endDate, 'en') : null;
  const price = r.pricing?.regular?.amount;
  return [
    H(3, r.heroTitle),
    r.heroSubhead,
    dates ? `Dates: ${dates}.` : null,
    typeof price === 'number' ? `Price: from USD ${price} per person.` : null,
    `Page: ${BUSINESS.url}/retreats/${r.slug}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function GET() {
  const stays = getStays('en');
  const retreats = listRetreatSlugs()
    .map((slug) => getRetreatBySlug(slug, 'en'))
    .filter((r): r is Retreat => !!r);

  let listings;
  try {
    listings = (await getPublishedRetreatListings()) ?? SEED_RETREAT_LISTINGS;
  } catch {
    listings = SEED_RETREAT_LISTINGS;
  }
  const { upcoming, past } = splitRetreatListings(listings, todayInCostaRica());
  const listing = (l: (typeof listings)[number]) =>
    `${l.title} (${l.label}) — ${l.instructors} — ${formatRetreatDates(l.startsOn, l.endsOn, 'en')}. ${l.description} More: ${isSitePath(l.url) ? `${BUSINESS.url}${l.url}` : l.url}`;

  const y = en.yoga;
  const s = en.stayWithUs;
  const sx = en.shaktiExperience;
  const hy = en.hostYourRetreat;
  const ytt = en.ytt;

  const doc = [
    H(1, `${BUSINESS.name} — the full site, in one document`),
    '',
    `> ${BUSINESS.description}`,
    '',
    `Canonical site: ${BUSINESS.url} · Spanish under ${BUSINESS.url}/es · Short card: ${BUSINESS.url}/llms.txt · Rebuilt hourly.`,
    '',
    H(2, 'The house, in facts'),
    '',
    bullets([
      `Name: ${BUSINESS.name} (Google Business profile: ${BUSINESS.alternateName}).`,
      `Where: ${BUSINESS.addressLines.slice(1).join(', ')} — on the Nicoya Peninsula, five minutes from Playa Hermosa. Coordinates ${BUSINESS.geo.latitude}, ${BUSINESS.geo.longitude}. Map: ${BUSINESS.googleMapsUrl}`,
      `WhatsApp and phone: ${BUSINESS.phoneDisplay} (${BUSINESS.whatsappUrl}). Email: ${BUSINESS.email.general}. Instagram: ${BUSINESS.instagram}`,
      `Reception: every day ${BUSINESS.openingHours.opens}–${BUSINESS.openingHours.closes}, Costa Rica time (UTC−6, no daylight saving).`,
      `On site: ${BUSINESS.amenities.join(', ')}. Price range: ${BUSINESS.priceRange}.`,
      'Booking: accommodation through the Cloudbeds engine on the site; yoga classes and class packs on the site; retreats, the teacher training and private group hire over WhatsApp.',
    ]),
    '',
    H(2, 'Home'),
    '',
    en.home.hero.headline,
    '',
    titled(en.home.pillars.items),
    '',
    `${en.home.featured.heading}: ${en.home.featured.intro}`,
    titled(en.home.featured.items),
    '',
    `"${en.home.testimonial.quote}" — ${en.home.testimonial.author}`,
    '',
    H(2, `Yoga & Wellbeing — ${BUSINESS.url}/yoga`),
    '',
    `${y.narrative.headline} ${y.narrative.body} (${y.narrative.labels.join(' · ')})`,
    '',
    `Class styles: ${Object.values(y.categories).join(', ')}. The weekly schedule is on the page and updates every week; each class is booked on the site, per class or with a class pack.`,
    '',
    H(3, y.packs.heading),
    y.packs.body,
    y.packs.codeBody,
    y.packs.paymentBody,
    '',
    H(3, y.special.heading),
    y.special.intro,
    titled(y.special.items),
    y.special.note,
    '',
    H(3, y.online.heading),
    `${y.online.body} ${y.online.note}`,
    '',
    H(3, y.team.heading),
    y.team.intro,
    bullets(Object.entries(y.team.members).map(([key, m]) => `${cap(key)} (${m.country}): ${m.disciplines.join(', ')}`)),
    '',
    H(3, y.faq.heading),
    faq(y.faq.items),
    '',
    H(2, `Stay With Us — ${BUSINESS.url}/stay-with-us`),
    '',
    `${s.intro.headline} ${s.intro.subline} ${s.intro.body}`,
    '',
    ...stays.flatMap((st) => [
      H(3, `${st.title} — ${st.meta}`),
      ...st.long,
      st.facts ? `${st.facts.label}: ${st.facts.items.join('; ')}.` : '',
      st.capacity ?? '',
      '',
    ]),
    H(3, s.activities.heading),
    s.activities.intro,
    titled(s.activities.items),
    s.activities.note,
    '',
    H(3, s.faq.heading),
    faq(s.faq.items),
    '',
    H(2, `Retreats hosted by House of Shakti — ${BUSINESS.url}/retreats`),
    '',
    `${en.retreats.intro.headline} ${en.retreats.intro.tagline}`,
    '',
    ...retreats.map(retreatBlock),
    '',
    H(2, `Upcoming Retreats — ${BUSINESS.url}/upcoming-retreats`),
    '',
    en.upcomingRetreats.meta.description,
    '',
    upcoming.length ? bullets(upcoming.map(listing)) : en.upcomingRetreats.empty,
    '',
    ...(past.length ? [H(3, en.upcomingRetreats.past.heading), en.upcomingRetreats.past.subline, bullets(past.map(listing)), ''] : []),
    H(2, `Shakti Experience — ${BUSINESS.url}/shakti-experience`),
    '',
    sx.hero.subtitle,
    '',
    sx.intro.headline,
    ...sx.intro.paragraphs,
    '',
    H(3, sx.pricing.heading),
    ...sx.pricing.tiers.map((t) => `${t.title} — ${t.duration} — ${t.price}. ${t.body} ${sx.pricing.includesLabel}: ${t.includes.join('; ')}.`),
    sx.pricing.groupNote,
    '',
    H(3, sx.whoFor.heading),
    bullets(sx.whoFor.audience.map((a) => `${a.lead} ${a.detail}`)),
    sx.whoFor.closing,
    '',
    H(3, sx.day.heading),
    sx.day.intro,
    bullets(sx.day.moments.map((m) => `${m.time} — ${m.title}: ${m.detail}`)),
    sx.day.afterword,
    '',
    H(3, sx.faq.heading),
    faq(sx.faq.items.map((i) => ({ question: i.q, answer: i.a }))),
    '',
    H(2, `Host Your Retreat — ${BUSINESS.url}/host-your-retreat`),
    '',
    `${hy.hero.headline} ${hy.hero.subline}`,
    hy.intro.headline,
    ...hy.intro.paragraphs,
    '',
    `${hy.stays.heading}: ${hy.stays.intro} The dwellings a group takes over are the Main House Suite, the Jungle Bungalow and La Casita (see Stay With Us).`,
    '',
    H(3, hy.activities.heading),
    hy.activities.intro,
    titled(hy.activities.items),
    hy.activities.note,
    '',
    `${hy.quote.heading}: ${hy.quote.intro} ${hy.quote.responseTime}`,
    `${hy.closing.heading} ${hy.closing.body}`,
    '',
    H(2, `Yoga Teacher Training — ${BUSINESS.url}/yoga-teacher-training`),
    '',
    `${ytt.hero.title}. ${ytt.hero.dates}, ${ytt.hero.location}. ${ytt.hero.subtitle}`,
    '',
    ytt.intro.headline,
    ...ytt.intro.paragraphs,
    '',
    H(3, ytt.curriculum.heading),
    bullets(ytt.curriculum.modules.map((m) => `${m.title} (${m.hours}) — ${m.focus}: ${m.points.join('; ')}`)),
    '',
    H(3, ytt.included.heading),
    bullets(ytt.included.items),
    `${ytt.included.notHeading}: ${ytt.included.notItems.join('; ')}. ${ytt.included.note}`,
    '',
    H(3, ytt.pricing.heading),
    bullets(ytt.pricing.tiers.map((t) => `${t.tag}: ${t.price} — ${t.detail}`)),
    ytt.pricing.onlineLine,
    `${ytt.pricing.paymentHeading}: ${ytt.pricing.schedule.join('; ')}.`,
    '',
    H(3, ytt.teachers.heading),
    ...ytt.teachers.bios.map((bio) => bio.join(' ')),
    '',
    H(3, ytt.whoFor.heading),
    ytt.whoFor.intro,
    bullets(ytt.whoFor.audience.map((a) => `${a.lead} ${a.detail}`)),
    '',
    H(3, ytt.faq.heading),
    faq(ytt.faq.items.map((i) => ({ question: i.q, answer: i.a }))),
    '',
    H(2, `About — ${BUSINESS.url}/about`),
    '',
    en.about.opening.second,
    '',
    ...en.about.nancy.paragraphs,
    en.about.nancy.pull,
    '',
    ...en.about.house.paragraphs,
    en.about.house.pull,
    '',
    H(2, `Contact — ${BUSINESS.url}/contact`),
    '',
    `${en.contact.reservations.heading}: ${en.contact.reservations.body}`,
    `${en.contact.host.heading}: ${en.contact.host.body}`,
    `${en.contact.visit.heading}: ${en.contact.visit.body}`,
    `${en.contact.press.heading}: ${en.contact.press.body} ${BUSINESS.email.press}`,
    '',
  ];

  return new Response(doc.filter((line) => line !== null && line !== undefined).join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
