import {
  breadcrumbSchema,
  faqPageSchema,
  lodgingBusinessSchema,
  retreatEventSchema,
  retreatListingEventsSchema,
  webSiteSchema,
  yogaClassEventsSchema,
  type FaqItem,
  type JsonLd as JsonLdObject,
} from '@/lib/schema';
import type { Retreat } from '@/lib/retreats';
import type { RetreatListing, YogaClass } from '@/types';

// ─── JSON-LD ─────────────────────────────────────────────────────────────────
// Server components only. Rendering the graph on the server is the whole
// point: a crawler that doesn't run JavaScript still sees it.
//
// `JSON.stringify` is what makes `dangerouslySetInnerHTML` safe here — the
// values are our own constants and database rows, and stringify escapes them
// into valid JSON. The one sequence that could still break out of a <script>
// block is a literal `</script>` inside a string, so it is neutralised below.
function serialize(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function Script({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  );
}

/**
 * The business and the site. Rendered once, on the home page, so every other
 * schema can point at it by `@id` without repeating it.
 */
export function SiteJsonLd() {
  return <Script data={[lodgingBusinessSchema(), webSiteSchema()]} />;
}

/** One Event per upcoming class. Renders nothing when the week is empty. */
export function YogaClassesJsonLd({ classes }: { classes: YogaClass[] }) {
  const events = yogaClassEventsSchema(classes);
  if (events.length === 0) return null;
  return <Script data={events} />;
}

/** The page's own questions and answers, as a FAQPage. Renders nothing without any. */
export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  const faq = faqPageSchema(items);
  if (!faq) return null;
  return <Script data={faq} />;
}

/** One Event per retreat still to come on /upcoming-retreats. Renders nothing when there are none. */
export function RetreatListingsJsonLd({ listings }: { listings: RetreatListing[] }) {
  const events = retreatListingEventsSchema(listings);
  if (events.length === 0) return null;
  return <Script data={events} />;
}

/**
 * A retreat: its Event, when it has real dates, plus the breadcrumb trail.
 * The breadcrumb always renders; the Event waits for `startDate`/`endDate`.
 */
export function RetreatJsonLd({ retreat }: { retreat: Retreat }) {
  const event = retreatEventSchema(retreat);
  const breadcrumb = breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Retreats', path: '/retreats' },
    { name: retreat.heroTitle, path: `/retreats/${retreat.slug}` },
  ]);

  return <Script data={event ? [event, breadcrumb] : [breadcrumb]} />;
}
