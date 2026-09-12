// ─── Structured data ─────────────────────────────────────────────────────────
// JSON-LD builders. Every fact comes from lib/business.ts, so the graph can
// never disagree with the page a person reads.
//
// Two rules hold throughout:
//
//   1. **Never guess.** A field the owners have not confirmed is omitted from
//      the output entirely. Wrong coordinates or an invented street send real
//      people to the wrong place; an incomplete schema only leaves a rich
//      result slightly less rich. As of 2026-09-07 everything but `legalName`
//      is confirmed, so the graph is close to complete — but the guards stay,
//      because the next fact to arrive will arrive the same way.
//   2. **Never emit an invalid type.** Where schema.org marks a property as
//      required — `startDate` on an Event, `address` on a LodgingBusiness —
//      the builder returns `null` rather than a partial object, and the caller
//      renders nothing. A malformed Event is worse than no Event: Google
//      discards it and flags the page.

import { BUSINESS } from '@/lib/business';
import type { Retreat } from '@/lib/retreats';
import type { RetreatListing, YogaClass } from '@/types';
import { isSitePath, DEFAULT_RETREAT_IMAGE } from '@/lib/retreat-listings';

export type JsonLd = Record<string, unknown>;

const BUSINESS_ID = `${BUSINESS.url}/#business`;
const WEBSITE_ID = `${BUSINESS.url}/#website`;

/**
 * PostalAddress.
 *
 * No `postalCode`: this address has none, and an empty string reads to a
 * consumer as "we don't know" rather than "there isn't one".
 */
function postalAddress(): JsonLd {
  return {
    '@type': 'PostalAddress',
    streetAddress: BUSINESS.address.street,
    addressLocality: BUSINESS.address.locality,
    addressRegion: BUSINESS.address.region,
    addressCountry: BUSINESS.address.country,
  };
}

/** GeoCoordinates, shared by the business and by every class's Place. */
function geoCoordinates(): JsonLd {
  return {
    '@type': 'GeoCoordinates',
    latitude: BUSINESS.geo.latitude,
    longitude: BUSINESS.geo.longitude,
  };
}

/** The place a class happens: the shala, at the house's address. */
function placeFor(locationName?: string): JsonLd {
  return {
    '@type': 'Place',
    name: locationName?.trim() ? `${BUSINESS.name} — ${locationName}` : BUSINESS.name,
    address: postalAddress(),
    geo: geoCoordinates(),
  };
}

/**
 * LodgingBusiness — the anchor of the whole graph. Everything else references
 * it by `@id`, so a search engine reads one business with several offerings
 * rather than several unrelated entities.
 */
export function lodgingBusinessSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': BUSINESS_ID,
    name: BUSINESS.name,
    alternateName: BUSINESS.alternateName,
    ...(BUSINESS.legalName ? { legalName: BUSINESS.legalName } : {}),
    description: BUSINESS.description,
    url: BUSINESS.url,
    logo: `${BUSINESS.url}/favicon.png`,
    image: `${BUSINESS.url}/og-image.jpg`,
    telephone: BUSINESS.phone,
    email: BUSINESS.email.general,
    // One ContactPoint per public mailbox, so an engine asked "how do I reach
    // them about X" can name the right inbox. `contactType` is free text in
    // schema.org; these are the words the contact page itself uses.
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'reservations',
        email: BUSINESS.email.general,
        telephone: BUSINESS.phone,
      },
      { '@type': 'ContactPoint', contactType: 'yoga studio', email: BUSINESS.email.yogaStudio },
      { '@type': 'ContactPoint', contactType: 'retreats', email: BUSINESS.email.retreats },
      { '@type': 'ContactPoint', contactType: 'press', email: BUSINESS.email.media },
    ],
    priceRange: BUSINESS.priceRange,
    address: postalAddress(),
    geo: geoCoordinates(),
    // The Google Business profile. `hasMap` is the property schema.org defines
    // for exactly this; `sameAs` is for identities, and a map pin is not one.
    hasMap: BUSINESS.googleMapsUrl,
    // Reception hours. One specification listing every day, rather than seven
    // near-identical ones — schema.org takes an array for `dayOfWeek` and
    // consumers read it the same way.
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: BUSINESS.openingHours.days.map(
        (day) => `https://schema.org/${day}`,
      ),
      opens: BUSINESS.openingHours.opens,
      closes: BUSINESS.openingHours.closes,
    },
    sameAs: [...BUSINESS.sameAs],
    amenityFeature: BUSINESS.amenities.map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    })),
  };
}

/** WebSite — lets the brand name resolve as a site rather than a stray page. */
export function webSiteSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: BUSINESS.url,
    name: BUSINESS.name,
    alternateName: BUSINESS.alternateName,
    inLanguage: 'en',
    publisher: { '@id': BUSINESS_ID },
  };
}

/**
 * One Event per yoga class.
 *
 * This is the strongest signal the site can send for "yoga classes santa
 * teresa": a dated, priced, located, bookable occurrence, refreshed weekly
 * from the recurring templates. Past classes are dropped — an index full of
 * finished events is worse than none.
 */
export function yogaClassEventSchema(yogaClass: YogaClass): JsonLd | null {
  const start = yogaClass.startsAt;
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return null;
  if (!yogaClass.name) return null;

  const end = new Date(start.getTime() + yogaClass.durationMinutes * 60_000);

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: yogaClass.name,
    ...(yogaClass.description ? { description: yogaClass.description } : {}),
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: placeFor(yogaClass.location),
    organizer: organizer(BUSINESS.email.yogaStudio),
    ...(yogaClass.instructor
      ? { performer: { '@type': 'Person', name: yogaClass.instructor } }
      : {}),
    ...(yogaClass.capacity ? { maximumAttendeeCapacity: yogaClass.capacity } : {}),
    offers: {
      '@type': 'Offer',
      price: yogaClass.priceUsd.toFixed(2),
      priceCurrency: 'USD',
      availability:
        yogaClass.spotsRemaining > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
      url: `${BUSINESS.url}/booking/${yogaClass.id}`,
      validFrom: new Date().toISOString(),
    },
  };
}

/** Only classes that haven't happened yet, as valid Events. */
export function yogaClassEventsSchema(classes: YogaClass[]): JsonLd[] {
  const now = Date.now();
  return classes
    .filter((c) => c.startsAt instanceof Date && c.startsAt.getTime() > now)
    .map(yogaClassEventSchema)
    .filter((s): s is JsonLd => s !== null);
}

/**
 * Event for a retreat.
 *
 * Returns `null` unless the retreat carries machine-readable `startDate` /
 * `endDate` — display copy like "July 18 – 24 · 2026" is not a timestamp, and
 * `startDate` is the one field schema.org marks required on an Event. Every
 * other field is emitted only when the retreat actually has it: the hosts,
 * the testimonials and the journey video in `lib/retreats.ts` are still
 * placeholder material and none of them reaches the graph.
 */
export function retreatEventSchema(retreat: Retreat): JsonLd | null {
  if (!retreat.startDate || !retreat.endDate) return null;

  // The standard rate. The early-bird price expires part-way through the
  // listing's life, and a single Offer that will stop being true is worse than
  // one that is always true.
  const price = retreat.pricing?.regular?.amount;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: retreat.heroTitle,
    ...(retreat.heroSubhead ? { description: retreat.heroSubhead } : {}),
    startDate: retreat.startDate,
    endDate: retreat.endDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: placeFor(),
    organizer: organizer(BUSINESS.email.retreats),
    ...(retreat.heroImage ? { image: `${BUSINESS.url}${retreat.heroImage}` } : {}),
    // Whoever actually holds the retreat. Only their name goes in: the
    // portraits and Instagram handles in `lib/retreats.ts` are still
    // placeholders, and a schema is not the place to publish a guess.
    ...(retreat.hosts?.length
      ? {
          performer: retreat.hosts
            .filter((host) => host.name?.trim())
            .map((host) => ({ '@type': 'Person', name: host.name })),
        }
      : {}),
    url: `${BUSINESS.url}/retreats/${retreat.slug}`,
    ...(typeof price === 'number'
      ? {
          offers: {
            '@type': 'Offer',
            price: price.toFixed(2),
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            url: `${BUSINESS.url}/retreats/${retreat.slug}`,
          },
        }
      : {}),
  };
}

/** BreadcrumbList for nested routes. */
export function breadcrumbSchema(trail: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: `${BUSINESS.url}${crumb.path}`,
    })),
  };
}

export type FaqItem = { question: string; answer: string };

/**
 * FAQPage — the questions a page already answers, in the language the page
 * is rendered in. Google stopped showing FAQ rich results for businesses in
 * 2023, but the answer engines still read the markup, and a question phrased
 * the way a guest asks it is the shape of what they retrieve. Only the
 * published answers go in: what the page says, nothing more.
 */
export function faqPageSchema(items: FaqItem[]): JsonLd | null {
  const entries = items.filter((i) => i.question?.trim() && i.answer?.trim());
  if (entries.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((i) => ({
      '@type': 'Question',
      name: i.question.trim(),
      acceptedAnswer: { '@type': 'Answer', text: i.answer.trim() },
    })),
  };
}

// "Sam Bianchini & Ana Ruiz", "Nancy Goodfellow and Elly Miles" → one Person each.
function performers(instructors: string): JsonLd[] {
  return instructors
    .split(/\s*(?:,|&|\band\b|\by\b)\s*/i)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ '@type': 'Person', name }));
}

/**
 * Event for a retreat managed in the panel (retreat_listings). Dates are
 * whole days in Costa Rica, so they go out as dates, not instants. The
 * facilitator's own page is the event's URL when the listing points off the
 * site; a retreat of the house's own points at its page here. No offer: the
 * panel holds no price, and a guess is worse than a gap.
 */
export function retreatListingEventSchema(listing: RetreatListing): JsonLd | null {
  if (!listing.title || !listing.startsOn || !listing.endsOn) return null;
  const url = isSitePath(listing.url) ? `${BUSINESS.url}${listing.url}` : listing.url;
  const image = listing.imageUrl || DEFAULT_RETREAT_IMAGE;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: listing.title,
    description: listing.description,
    startDate: listing.startsOn,
    endDate: listing.endsOn,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: placeFor(),
    organizer: organizer(BUSINESS.email.retreats),
    performer: performers(listing.instructors),
    image: image.startsWith('http') ? image : `${BUSINESS.url}${image}`,
    url,
  };
}

/** Only the retreats still to come, as valid Events. */
export function retreatListingEventsSchema(listings: RetreatListing[]): JsonLd[] {
  return listings
    .map(retreatListingEventSchema)
    .filter((s): s is JsonLd => s !== null);
}

/**
 * The house as the organizer of an event, with the mailbox that actually
 * answers about it: the studio's for a class, the retreats desk for a retreat.
 */
function organizer(email: string): JsonLd {
  return {
    '@type': 'Organization',
    '@id': BUSINESS_ID,
    name: BUSINESS.name,
    url: BUSINESS.url,
    email,
  };
}
