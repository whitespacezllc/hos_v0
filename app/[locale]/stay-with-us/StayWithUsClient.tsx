'use client';

import { useState, useRef } from 'react';
import { motion, Variants, useInView, AnimatePresence } from 'framer-motion';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { StayCard } from '@/components/stay-with-us/StayCard';
import { StayLightbox } from '@/components/stay-with-us/StayLightbox';
import { EnhanceYourExperience } from '@/components/stay-with-us/EnhanceYourExperience';
import { Navigation } from '@/components/landing/navigation';
import { Footer } from '@/components/landing/footer';
import { SeasonalExperiences } from '@/components/landing/seasonal-experiences';
import { AccommodationsFAQ } from '@/components/accommodations/AccommodationsFAQ';
import { HeroVideo, heroCuts } from '@/components/shared/HeroVideo';
import { getStays, type StayData } from '@/lib/stays';

// Booking happens on /book, where the Cloudbeds engine renders in the page;
// every CheckAvailabilityLink below is a plain link there (lib/cloudbeds.ts).

// ─── Word-by-word reveal variants (same easing as home Introduction) ─────────
const headlineContainer: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.18, delayChildren: 0.1 } },
};
const headlineWord: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Reusable word-reveal component ──────────────────────────────────────────
function WordRevealHeading({
  text,
  className,
  as: As = 'h2',
  inView,
}: {
  text: string;
  className: string;
  as?: 'h1' | 'h2' | 'h3';
  inView: boolean;
}) {
  const words = text.split(' ');
  return (
    <motion.div
      variants={headlineContainer}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      className={className}
    >
      <As className="font-display font-light leading-[1.1] tracking-[-0.01em]" aria-label={text}>
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            aria-hidden
            className="inline-block overflow-hidden align-baseline"
          >
            <motion.span
              variants={headlineWord}
              className="inline-block will-change-transform"
            >
              {word}
              {/* non-breaking space — regular ASCII space gets collapsed by inline-block */}
              {i < words.length - 1 ? ' ' : ''}
            </motion.span>
          </span>
        ))}
      </As>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// HERO — editorial video, same pattern as home & yoga
// ═════════════════════════════════════════════════════════════════════════════
function AccommodationsHero() {
  return (
    <section className="bg-warm-white">
      {/*
        Hero + navbar together fill exactly 100vh.
        Mobile: full-bleed. Desktop: 80% container with margins.
        mt-* offsets the fixed navbar so the hero sits *below* it.
      */}
      <div className="w-full md:w-[80%] mx-auto mt-16 md:mt-20">
        <div
          className="
            relative overflow-hidden bg-dark
            h-[calc(100svh-4rem)] md:h-[calc(100svh-5rem)]
          "
        >
          <HeroVideo {...heroCuts('accomodation')} />
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// INTRO — short, scannable orientation (no image)
// Sets the expectation that there are four distinct dwellings
// before the grid below.
// ═════════════════════════════════════════════════════════════════════════════
// The words live in the catalogue under stayWithUs.intro: the claim, its
// second beat, and the four labels that name what the place actually holds —
// four words, so they read as a rhythm rather than a feature list.
function AccommodationsIntro() {
  const t = useTranslations('stayWithUs.intro');
  const labels = useMessages().stayWithUs.intro.labels;
  const textRef = useRef<HTMLDivElement | null>(null);
  const textInView = useInView(textRef, { once: true, margin: '-100px' });

  return (
    <section className="bg-warm-white py-20 lg:py-28 overflow-hidden">
      <div ref={textRef} className="w-[90%] md:w-[80%] mx-auto">
        <div className="max-w-3xl">
          {/* The page's h1 — it had none before, only an h2, so the document
              opened without ever naming itself. */}
          <WordRevealHeading
            as="h1"
            text={t('headline')}
            inView={textInView}
            className="text-ink text-4xl md:text-5xl lg:text-6xl"
          />

          {/* The second beat of the same phrase, not a competing headline:
              same display face, a step down in size and weight of colour, so
              the couplet reads as one breath. */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={textInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 1.0 }}
            className="font-display font-light text-ink/65 text-2xl md:text-3xl lg:text-4xl leading-[1.15] tracking-[-0.01em] mt-4 lg:mt-5"
          >
            {t('subline')}
          </motion.p>

          {/* No rule and no container: the labels sit straight on the page and
              are held by space alone. `gap-y` carries the wrap on a phone,
              where four tracked labels don't fit one line. */}
          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={textInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 1.3 }}
            className="flex flex-wrap items-center gap-x-3 md:gap-x-5 gap-y-3 mt-10 lg:mt-12"
          >
            {labels.map((label, i) => (
              <li key={label} className="flex items-center gap-3 md:gap-5">
                {i > 0 && (
                  <span aria-hidden className="h-3 w-px bg-ink/25 select-none" />
                )}
                {/* Tracking eases off on a phone so the four hold one line —
                    wrapped, the last word reads as an orphan rather than as
                    the close of a rhythm. */}
                <span className="font-body text-[10px] md:text-[11px] tracking-[0.2em] md:tracking-[0.28em] uppercase text-ink/80">
                  {label}
                </span>
              </li>
            ))}
          </motion.ul>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={textInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 1.5 }}
            className="font-body text-ink max-w-2xl text-sm leading-[1.7] mt-10 lg:mt-12"
          >
            {t('body')}
          </motion.p>
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STAYS GRID — 2×2 desktop, single column mobile.
// The four dwellings, in the order Nancy presents them, from lib/stays — the
// same records /host-your-retreat shows as a shop window. Capacity + layout
// ride in the fact line under each title; the full description, bed
// configurations and capacity live in the lightbox.
// ═════════════════════════════════════════════════════════════════════════════

function StaysGrid() {
  const stays = getStays(useLocale());
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  // Which dwelling is expanded, and on which photograph it opened.
  const [expanded, setExpanded] = useState<{ stay: StayData; index: number } | null>(null);

  // No top padding — the intro above already closes with py-20/28. Doubling it
  // pushed the first row out of the fold on laptop viewports.
  return (
    <section className="bg-warm-white pb-20 lg:pb-28">
      <div ref={ref} className="w-[90%] md:w-[80%] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          /* Phones stack, tablets pair. From lg the grid dissolves into
             editorial rows (see StayCard): at two columns on a wide monitor
             each 3:4 photograph ran ~1000px tall with dead air beside it, and
             at four columns no dwelling had any presence at all. One dwelling
             per row, photo and story side by side, gives each its moment —
             and the lightbox still owns the full-size photograph. */
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-x-8 gap-y-14 lg:gap-y-28"
        >
          {stays.map((stay, i) => (
            <StayCard
              key={stay.slug}
              stay={stay}
              index={i}
              onExpand={(index) => setExpanded({ stay, index })}
            />
          ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {expanded && (
          <StayLightbox
            stay={expanded.stay}
            initialIndex={expanded.index}
            onClose={() => setExpanded(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CLOSING NARRATIVE — REMOVED in favor of <SeasonalExperiences /> reused from
// the home. The "An ode to the jungle." text + image lived here previously;
// the assets remain in /public so we can revive the block on another page
// if needed.
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function StayWithUsClient() {
  return (
    <main id="main-content" className="bg-warm-white overflow-hidden">
      {/* Every CheckAvailabilityLink on this page leads to /book. */}
      <Navigation />
      <AccommodationsHero />
      <AccommodationsIntro />
      <StaysGrid />
      {/* The activities layer — what fills the days once the guest knows
          where they sleep. Before Featured Experiences, which then reads as
          the deeper, structured tier of the same offer. */}
      <EnhanceYourExperience />
      <SeasonalExperiences />
      <AccommodationsFAQ />
      <Footer />
    </main>
  );
}
