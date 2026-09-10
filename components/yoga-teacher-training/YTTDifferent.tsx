'use client';

import { useRef } from 'react';
import { motion, Variants, useInView } from 'framer-motion';
import { LoopingClip } from '@/components/shared/LoopingClip';
import { Ornament } from '@/components/shared/ornament';
import { TrackArrows } from '@/components/shared/TrackArrows';
import { useCarousel } from '@/hooks/use-carousel';
import { useMessages } from 'next-intl';

const MEDIA = '/videos/more-than-a-training';

// The card text lives in the dictionary (both languages); only the clip slugs
// live here, zipped with it by index at render.
const CARD_SLUGS = [
  'move-from-presence-c',
  'teached-live-c',
  'body-relationship-c',
  'leadership-c',
];

const grid: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};
const card: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 1.0, ease: 'easeOut' } },
};

export function YTTDifferent() {
  const t = useMessages().ytt;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const { trackRef, atStart, atEnd, step, hasOverflow } = useCarousel();


  return (
    <section className="bg-warm-white py-20 lg:py-28">
      <div
        ref={ref}
        className="w-[90%] md:w-[80%] mx-auto lg:grid lg:grid-cols-3 lg:gap-12"
      >
        {/* ── Left — the claim ────────────────────────────────────────── */}
        <div className="lg:col-span-1 lg:pr-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            className="w-fit"
          >
            <Ornament src="/logos/moon-phase.png" className="h-[42px] md:h-12 mb-5 lg:mb-6" />
            <h2 className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15]">
              {t.different.heading}
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
            className="font-body text-sm text-ink leading-relaxed mt-6 lg:mt-10 max-w-full lg:max-w-xs"
          >
            {t.different.sub}
          </motion.p>

          {/* Arrows sit with the copy, not over the cards — the track still
              scrolls and drags as before; these are a second way in, not the
              only one. Hidden outright when everything already fits. */}
          {hasOverflow && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
              className="mt-8 lg:mt-10"
            >
              <TrackArrows
                atStart={atStart}
                atEnd={atEnd}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
              />
            </motion.div>
          )}
        </div>

        {/* ── Right — the four differentiators ────────────────────────── */}
        <div className="lg:col-span-2 mt-12 lg:mt-0">
          {/* The track starts on the container's left edge, like every other
              section, and runs off the right one. That asymmetry is the whole
              affordance: a card cut by the screen edge says the row continues,
              where a tidy right margin says it has ended. The gutter is exactly
              5vw of viewport (10vw from md), which is what these negative
              margins cancel. On desktop the track stays inside its column,
              where the cards are already visibly cut by the grid. */}
          <motion.div
            ref={trackRef}
            variants={grid}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="
              flex gap-6 lg:gap-8
              overflow-x-auto snap-x snap-proximity scroll-smooth
              select-none
              [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
              -mr-[5vw] md:-mr-[10vw] lg:mr-0
            "
          >
            {CARD_SLUGS.map((slug, i) => (
              <motion.article
                key={slug}
                variants={card}
                className="
                  flex-shrink-0 snap-start
                  w-[72vw] max-w-[340px]
                  lg:w-[40vw] lg:max-w-[400px]
                "
              >
                {/* 4/5 rather than the square the reference uses: this footage
                    was shot 3:4 portrait, and squaring it would cut a quarter of
                    the frame's height off bodies usually standing in it. */}
                <LoopingClip
                  src={`${MEDIA}/${slug}.mp4`}
                  poster={`${MEDIA}/${slug}-poster.jpg`}
                  className="aspect-[4/5]"
                />

                <h3 className="font-display font-light text-ink text-lg lg:text-xl leading-tight mt-4">
                  {t.different.cards[i].title}
                </h3>
                <p className="font-body text-sm text-ink leading-relaxed mt-3">
                  {t.different.cards[i].body}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
