'use client';

import { useMessages, useTranslations } from 'next-intl';
import { TestimonialCarousel, type TestimonialSlide } from '@/components/shared/TestimonialCarousel';

// ─── Guests, in their own words ──────────────────────────────────────────────
// Three Google reviews, each over its own photograph: the room mid-flow for
// the one about Nancy's teaching, the shala in its setting for the one about
// the place, the house at dusk for the one that calls it magical. Portrait
// cuts for phones, where a landscape frame would keep only its middle third.
//
// Scrims are measured per photograph, per tile under the quote's own box, at
// 375, 768, 1440 and 1920, against cream, with the scrim composited in sRGB
// — re-measure if a photograph is swapped. At 0.55, the value the single
// testimonials use, all three photographs left the 20px phone quote just
// under 4.5:1 (4.0, 4.5 and 4.2), and the shala from outside left the 768px
// caption at 4.1: the brightest tiles are the open wall behind the class, the
// lit grass past the deck, and the dusk sky. 0.58 is what each of them needs;
// 0.60 holds all three with a margin, and one value across the set keeps the
// crossfade from stepping the photographs lighter and darker.
const BACKDROPS: Array<Pick<TestimonialSlide, 'image' | 'scrim'>> = [
  {
    image: {
      desktop: '/images/yoga/testimonials/01-desktop.webp',
      mobile: '/images/yoga/testimonials/01-mobile.webp',
    },
    scrim: 0.60,
  },
  {
    image: {
      desktop: '/images/yoga/testimonials/02-desktop.webp',
      mobile: '/images/yoga/testimonials/02-mobile.webp',
    },
    scrim: 0.60,
  },
  {
    image: {
      desktop: '/images/yoga/testimonials/03-desktop.webp',
      mobile: '/images/yoga/testimonials/03-mobile.webp',
    },
    scrim: 0.60,
  },
];

export function YogaTestimonials() {
  const t = useTranslations('yoga.testimonials');
  const items = useMessages().yoga.testimonials.items;

  const slides: TestimonialSlide[] = items.map((item, i) => ({
    quote: item.quote,
    author: item.author,
    role: t('source'),
    ...BACKDROPS[i % BACKDROPS.length],
  }));

  return (
    <TestimonialCarousel
      slides={slides}
      labels={{
        region: t('region'),
        previous: t('previous'),
        next: t('next'),
        slide: (n, total) => t('slide', { n, total }),
      }}
    />
  );
}
