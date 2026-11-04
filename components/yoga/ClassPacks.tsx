'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { motion, Variants, useInView } from 'framer-motion';

// The sizes are presented as figures, not as price cards. Prices are
// deliberately absent: they are read from Supabase and rendered on /paquetes,
// so repeating them here would guarantee a stale number on the landing the
// first time the studio adjusts them.
//
// Nothing in this file draws a line. What the hairlines used to do is done by
// two things and only two.
//
// Alignment, for the vertical rule: every numeral starts on the section's left
// margin, every unit label on a second edge, every line of copy on a third.
// Two edges facing each other across white space are what the eye reads as a
// line, which is why the rule was redundant in the first place.
//
// A ratio of space, for the horizontal rules. Three tiers, each about double
// the one below it: 8-16px inside a size, 48-64px between two sizes, 96-128px
// between blocks. Proximity is read before weight or alignment, so as long as
// each tier is unambiguously larger than the one under it the grouping is
// legible without a stroke. The section's own py-20/28 sits between two
// neighbours with the same padding, so the seam is 160-224px of combined air:
// still the largest gap in play, which keeps the block from bleeding into the
// section above it.
// The sizes on sale; their cadence and note live in the catalogue under
// yoga.packs.sizes, keyed by the count.
const PACK_SIZES = ['5', '10'] as const;

// Stagger constants live here rather than inline so the closing block's delay
// can be derived from them: with no rule to mark where the strip ends, the
// small print must not start arriving while sizes are still landing.
const LEAD_IN = 0.15;
const STAGGER = 0.15;
const CLOSING_DELAY = LEAD_IN + PACK_SIZES.length * STAGGER;

// The container itself never fades: only the children carry opacity, so the
// figures are not dimmed twice over by a parent that is still animating.
const sizesContainer: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: STAGGER, delayChildren: LEAD_IN } },
};

// The sizes travel further than the blocks around them (24px against 16px).
// With nothing drawn between the rows, the entrance is the first thing that
// says there are three of them: three separate arrivals, not one band settling.
const sizesItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 1.0, ease: 'easeOut' } },
};

export function ClassPacks() {
  const t = useTranslations('yoga.packs');
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="bg-warm-white py-20 lg:py-28">
      <div ref={ref} className="w-[90%] md:w-[80%] mx-auto">
        {/* Two halves with a wide gutter rather than a divided row. Both are
            measured well below their track: what they give up widens the
            gutter, so at 1920 the pause between them grows instead of the
            lines growing to 90 characters. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-y-8 lg:gap-x-24 xl:gap-x-32"
        >
          <div>
            <p className="font-body text-[11px] tracking-[0.28em] uppercase text-ink/70">
              {t('eyebrow')}
            </p>

            {/* The headline carries the mechanism, not the discount. The saving
                is stated once, in the paragraph, where it can be read plainly. */}
            <h2 className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15] mt-5 max-w-[20ch]">
              {t('heading')}
            </h2>
          </div>

          <div className="lg:pt-2">
            <p className="font-body text-sm text-ink leading-[1.7] max-w-[46ch]">
              {t('body')}
            </p>
          </div>
        </motion.div>

        {/* The sizes are stacked, not columned. Three columns of prose with
            nothing drawn between them collapse into one paragraph spilled in
            three, so the comparison is turned on its side: each size takes a
            full-width row and the three rows repeat exactly the same silhouette
            — figure, unit, cadence, note. Three identical shapes read as a
            series without a rule to declare it, and stacking puts 5, 10 and 20
            on one left edge, a few centimetres apart, which compares them more
            directly than three columns separated by a wide gutter would.

            A real list, not a stack of divs: with the rules gone, the markup is
            all a screen reader has left to know there are three of anything. */}
        <motion.ul
          variants={sizesContainer}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="list-none mt-24 lg:mt-32 space-y-12 lg:space-y-16"
        >
          {PACK_SIZES.map((count) => (
            <motion.li
              key={count}
              variants={sizesItem}
              className="md:flex md:items-baseline md:gap-x-10 lg:gap-x-16"
            >
              {/* One size for all three numerals: the comparison only works if
                  nothing has been typographically pre-selected for the reader.
                  They stay in ink rather than taking the accent — three
                  88px burgundy figures would be the loudest thing on the page
                  and would turn an offer into a price table.

                  tabular-nums plus a min measure of 2.4 digits is the whole
                  alignment device: every numeral box is the same width whether
                  it holds one digit or two, so the unit labels line up on a
                  second edge and the copy on a third. min-w rather than w, so
                  an unexpected glyph width in the display face pushes the box
                  open instead of clipping it. */}
              <p className="flex items-baseline gap-3 md:gap-4 md:shrink-0">
                <span className="font-display font-light text-ink text-5xl md:text-6xl leading-none tracking-[-0.02em] tabular-nums min-w-[2.4ch]">
                  {count}
                </span>
                <span className="font-body text-[10px] tracking-[0.24em] uppercase text-ink/70">
                  {t('classes')}
                </span>
              </p>

              {/* Baseline-aligned with the numeral, so the row has a spine the
                  reader can feel across the empty channel where the rule was.
                  Inside the row the type steps down once — full ink at 16px,
                  then /70 at 14px — and that step, repeated identically three
                  times, is what marks the cadence as the title of the unit and
                  the note as its tail. /70 is the floor: over warm white it
                  holds 4.6:1, and /60 would drop body copy to 3.2:1. */}
              <div className="mt-4 md:mt-0 md:min-w-0">
                <p className="font-body text-base text-ink leading-[1.6]">
                  {t(`sizes.${count}.cadence`)}
                </p>

                {/* Bounded to a measure that lands all three notes on two lines
                    from md up, so the rows keep one silhouette. */}
                <p className="font-body text-sm text-ink/70 leading-[1.7] mt-2 max-w-[42ch]">
                  {t(`sizes.${count}.note`)}
                </p>
              </div>
            </motion.li>
          ))}
        </motion.ul>

        {/* Operational detail is demoted by distance and tone rather than by
            being pushed under a rule: it matters at the moment of purchase, not
            while the reader is still deciding. The gap above is double the gap
            between two sizes, which is what keeps this from reading as a fourth
            size. The CTA comes first in the DOM so it precedes the small print
            on a phone, and it takes only the width it needs — a matching column
            would park "Payment" under the last note and read as a footnote to
            the 20. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: CLOSING_DELAY }}
          className="mt-24 lg:mt-32 grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start gap-y-12 lg:gap-x-24 xl:gap-x-32"
        >
          <div>
            <Link
              href="/paquetes"
              className="inline-block bg-dark text-cream font-body text-sm tracking-[0.05em] px-8 py-3.5 hover:bg-burgundy transition-colors duration-300"
            >
              {t('cta')}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8 lg:pt-1">
            <div>
              <p className="font-body text-[10px] tracking-[0.24em] uppercase text-ink/70">
                {t('codeLabel')}
              </p>
              <p className="font-body text-xs text-ink/70 leading-[1.7] mt-3 max-w-[38ch]">
                {t('codeBody')}
              </p>
            </div>

            <div>
              <p className="font-body text-[10px] tracking-[0.24em] uppercase text-ink/70">
                {t('paymentLabel')}
              </p>
              <p className="font-body text-xs text-ink/70 leading-[1.7] mt-3 max-w-[38ch]">
                {t('paymentBody')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}