'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Ornament } from '@/components/shared/ornament';
import { TrackArrows } from '@/components/shared/TrackArrows';
import { useCarousel } from '@/hooks/use-carousel';
import { useDragScroll } from '@/hooks/use-drag-scroll';

// ─── Activities track ────────────────────────────────────────────────────────
// The layer of things to do around a page's main subject: what fills the days
// on /stay-with-us, the hours between classes on /yoga, the programme a host
// can add to on /host-your-retreat. Same architecture as Featured Experiences
// — copy and controls in the first column, a horizontal track in the other two
// — so a reader moving between pages reads one language instead of learning a
// second. Three sections carried their own copy of this markup before; this is
// the one they now share, and the words, the photographs and the ornament are
// all that change between them.

export type TrackActivity = {
  /**
   * Where it happens ("On site" / "Off site"). Rendered as a small mark above
   * the title when a track mixes the two, so a guest planning their days can
   * tell a massage down the path from a morning out on a boat. Left out on
   * tracks where everything happens at the house.
   */
  where?: string;
  title: string;
  description: string;
  /** Optional secondary line ("Optional: …", "Choose 2–3 meals a day…"). */
  note?: string;
  image: string;
};

export function ActivitiesTrack({
  heading,
  intro,
  note,
  ariaLabel,
  items,
  ornament = '/logos/crescent-sun-rays.png',
  spacing = 'py-20 lg:py-28',
  afterword,
}: {
  heading: string;
  /** The invitation, one or two sentences. */
  intro: string;
  /**
   * How they are arranged. Sits with the invitation rather than under the
   * track: the question — "and how do I actually get these?" — arrives while
   * the reader is still looking at the first card, not after the last. It is
   * practical information, in a quieter voice, and the step down in size and
   * colour is what sets it apart.
   */
  note?: string;
  /** Accessible name of the scrolling region. */
  ariaLabel: string;
  items: TrackActivity[];
  /** The brand mark sealing the heading. */
  ornament?: string;
  /** Vertical rhythm — a section that follows straight on from another may drop its top padding. */
  spacing?: string;
  /**
   * What holds for the whole row, said once, under it — after the reader has
   * walked the cards rather than before. Where `note` answers "how do I get
   * these?" beside the first card, this is the sentence the row adds up to.
   */
  afterword?: string;
}) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });

  const { trackRef, atStart, atEnd, step, hasOverflow } = useCarousel<HTMLDivElement>();
  const { dragHandlers } = useDragScroll(trackRef);

  return (
    <section className={`bg-warm-white ${spacing}`}>
      <div
        ref={sectionRef}
        className="w-[90%] md:w-[80%] mx-auto lg:grid lg:grid-cols-3 lg:gap-12"
      >
        {/* ── Left — the invitation and the controls ─────────────────── */}
        <div className="lg:col-span-1 lg:pr-12">
          <div className="w-fit">
            <Ornament src={ornament} className="h-[42px] md:h-12 mx-auto mb-5 lg:mb-6" />
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
              className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15]"
            >
              {heading}
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
            className="font-body text-sm text-ink leading-relaxed mt-6 lg:mt-10 max-w-full lg:max-w-xs"
          >
            {intro}
          </motion.p>

          {note && (
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 1.0, ease: 'easeOut', delay: 0.3 }}
              className="font-body text-xs text-ink/75 leading-[1.7] mt-8 lg:mt-10 max-w-full lg:max-w-xs"
            >
              {note}
            </motion.p>
          )}

          {/* Arrows sit with the copy, never over the photographs. Hidden
              outright when every card already fits. */}
          {hasOverflow && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 1.0, ease: 'easeOut', delay: 0.4 }}
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

        {/* ── Right — the track ──────────────────────────────────────── */}
        <div className="lg:col-span-2 mt-12 lg:mt-0">
          {/* The track starts on the container's left edge and runs off the
              right one — a card cut by the screen edge says the row continues.
              The gutter cancelled is exactly 5vw of viewport, 10vw from md,
              since the container is 90%/80% and centred. */}
          {/* The cards are the track's DIRECT children, never wrapped: the
              carousel hook steps by measuring the track's first child plus
              its column-gap, and a wrapper would make one arrow press jump
              the entire strip. */}
          <div
            ref={trackRef}
            {...dragHandlers}
            role="region"
            aria-label={ariaLabel}
            tabIndex={0}
            className="
              flex gap-5 lg:gap-6
              overflow-x-auto snap-x snap-proximity scroll-smooth
              cursor-grab select-none
              [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
              -mr-[5vw] md:-mr-[10vw] lg:mr-0
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40
            "
          >
            {items.map((activity, i) => (
              <motion.article
                key={activity.title}
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                // The stagger stops climbing after the sixth card: past that
                // they enter off-screen anyway, and a late card waiting most
                // of a second is a card that animates in after the reader has
                // already scrolled to it.
                transition={{
                  duration: 0.9,
                  ease: 'easeOut',
                  delay: 0.08 * Math.min(i, 5),
                }}
                className="
                  flex-shrink-0 snap-start
                  w-[62vw] max-w-[290px]
                  md:w-[32vw] lg:w-[220px] xl:w-[270px]
                "
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-ink/5">
                  <img
                    src={activity.image}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                </div>

                {activity.where && (
                  <p className="font-body text-[10px] tracking-[0.25em] uppercase text-ink/70 mt-4">
                    {activity.where}
                  </p>
                )}
                <h3
                  className={`font-display font-light text-ink text-base lg:text-lg leading-snug ${
                    activity.where ? 'mt-2' : 'mt-4'
                  }`}
                >
                  {activity.title}
                </h3>
                <p className="font-body text-sm text-ink leading-relaxed mt-2">
                  {activity.description}
                </p>
                {activity.note && (
                  <p className="font-body text-xs text-ink/75 leading-relaxed mt-2">
                    {activity.note}
                  </p>
                )}
              </motion.article>
            ))}
          </div>

          {afterword && (
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 1.0, ease: 'easeOut', delay: 0.3 }}
              className="font-body text-sm text-ink/80 leading-[1.8] mt-8 lg:mt-10 max-w-2xl"
            >
              {afterword}
            </motion.p>
          )}
        </div>
      </div>
    </section>
  );
}
