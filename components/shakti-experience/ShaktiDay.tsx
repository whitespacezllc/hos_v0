'use client';

import { ActivitiesTrack } from '@/components/shared/ActivitiesTrack';
import { useMessages } from 'next-intl';

// ─── A day at House of Shakti ────────────────────────────────────────────────
// The day as a row of moments, in the same track "More than a stay" rides a
// few sections up: one card per moment, its hour as the mark above the title
// and a photograph of that very moment — breakfast at the table, the class in
// the shala, the beach, the breathwork, the sauna. A timeline told this way
// takes one screen instead of three, and on a phone it swipes.
//
// After the timed moments come the three that have no hour — massage and
// nature, lunch and dinner, getting around — as cards of their own, marked
// "on request" and "at your pace" where the others carry a time. They used
// to be a paragraph of practical notes beside the invitation; as cards they
// are part of the day, and the day reads as what it is: a rhythm with room
// in it. What holds for the whole row — the team is there, the choices are
// yours — is said once, under the track.
const IMAGES: Record<string, string> = {
  breakfast: '/images/shakti-experience/more-than-a-stay/nourishing-food.webp',
  yoga: '/images/shakti-experience/introduction/intro-slider-9.webp',
  'free-time': '/images/shakti-experience/introduction/intro-slider-2.webp',
  breathwork: '/images/shakti-experience/more-than-a-stay/breathwork.webp',
  sauna: '/images/shakti-experience/introduction/intro-slider-21.webp',
  // The waterfall over the massage table: the card says both, and the day
  // already has its indoor moments. The kitchen and the ATV are the owners'
  // own photographs for these two.
  'massage-nature': '/images/shakti-experience/more-than-a-stay/nature-experience.webp',
  'lunch-dinner': '/images/shakti-experience/more-than-a-stay/lunch-dinner.webp',
  'getting-around': '/images/shakti-experience/more-than-a-stay/atv-rental.webp',
};

export function ShaktiDay() {
  const t = useMessages().shaktiExperience.day;

  return (
    <ActivitiesTrack
      heading={t.heading}
      intro={t.intro}
      afterword={t.afterword}
      ariaLabel={t.trackAria}
      ornament="/logos/moon-phase.png"
      items={t.moments.map((moment) => ({
        where: moment.time,
        title: moment.title,
        description: moment.detail,
        image: IMAGES[moment.slug],
      }))}
    />
  );
}
