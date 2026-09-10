'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, Variants, useInView } from 'framer-motion';
import { Ornament } from '@/components/shared/ornament';
import { usePrefersReducedMotion } from '@/hooks/use-media-query';
import { usePageVisible } from '@/hooks/use-page-visible';
import { useMessages } from 'next-intl';

// 24 frames from the training, all shot 3:4 portrait.
const POOL = Array.from(
  { length: 24 },
  (_, i) => `/images/introduction/ytt-introduction-${String(i + 1).padStart(2, '0')}.webp`,
);

// Four slots, deliberately unequal — two large flanked by two small, each hung
// at a different height so the row reads as an editorial arrangement rather
// than a grid. The 4/5 frame in the third slot crops its 3:4 source slightly,
// which is what keeps the row from looking mechanically repeated.
//
// The row only becomes a centred arrangement at desktop width. Fitting all four
// into a tablet was tried and measured: at 768px the container leaves each frame
// about 104px, which turns the photographs into stamps. Below lg they keep a
// generous fixed size and the row scrolls instead — three frames worth looking
// at, swiped, beats four too small to read.
const SLOTS = [
  { width: 'w-44 lg:w-[16%]', offset: 'lg:mt-20', aspect: 'aspect-[3/4]' },
  { width: 'w-56 lg:w-[24%]', offset: 'lg:mt-0', aspect: 'aspect-[3/4]' },
  { width: 'w-56 lg:w-[24%]', offset: 'lg:mt-28', aspect: 'aspect-[4/5]' },
  { width: 'w-44 lg:w-[16%]', offset: 'lg:mt-10', aspect: 'aspect-[3/4]' },
];

// Each slot waits a fresh random beat between swaps rather than running on a
// fixed interval. Fixed intervals — even different ones — eventually line up and
// start pulsing in unison; re-rolling the delay after every swap means the four
// never settle into a rhythm the eye can predict.
const MIN_DELAY = 3000;
const MAX_DELAY = 5200;

/**
 * Drives which image each slot is showing.
 *
 * Starts from a fixed set so the server and the client render the same markup,
 * then goes random once mounted. A replacement is drawn only from images no slot
 * is currently showing, so the same photo never appears twice in the row, and it
 * is fetched before being committed — swapping to an image the browser hasn't
 * got yet would flash an empty frame mid-crossfade.
 */
function useRotatingSlots(enabled: boolean) {
  const [indices, setIndices] = useState<number[]>(() => SLOTS.map((_, i) => i));

  // Timers read the live value without re-subscribing the effect on every swap.
  const indicesRef = useRef(indices);
  indicesRef.current = indices;

  useEffect(() => {
    if (!enabled) return;

    const timers = new Set<number>();
    let cancelled = false;

    const after = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };

    const schedule = (slot: number) => {
      after(MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY), () => {
        if (cancelled) return;

        const onScreen = new Set(indicesRef.current);
        const candidates = POOL.map((_, i) => i).filter((i) => !onScreen.has(i));
        const next = candidates[Math.floor(Math.random() * candidates.length)];

        let settled = false;
        const commit = () => {
          if (settled || cancelled) return;
          settled = true;
          setIndices((prev) => {
            const copy = [...prev];
            copy[slot] = next;
            return copy;
          });
          schedule(slot);
        };

        // Fetch before swapping, so the crossfade never reveals a frame the
        // browser hasn't got yet.
        const img = new Image();
        img.onload = commit;
        img.onerror = commit;
        img.src = POOL[next];
        if (img.complete) commit();

        // A slot only queues its next turn from inside commit, so anything that
        // swallows both events would strand it permanently. That is not
        // hypothetical: hide the tab and the browser suspends image decoding,
        // which is exactly when these timers are still running. Move on
        // regardless after a beat — a slightly early swap is recoverable,
        // a dead slot is not.
        after(1500, commit);
      });
    };

    SLOTS.forEach((_, slot) => schedule(slot));

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, [enabled]);

  return indices;
}

const headlineContainer: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};
const headlineWord: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
};

export function YTTIntro() {
  const t = useMessages().ytt;
  const HEADLINE = t.intro.headline;
  const ref = useRef<HTMLDivElement | null>(null);

  // Rotation runs only when someone can actually see it, which takes both
  // checks. In-viewport alone isn't enough: this section can sit dead centre of
  // a tab the reader switched away from, and a hidden page suspends both image
  // decoding and animation frames — so swaps would keep firing while the
  // crossfades they trigger never finish, leaving every outgoing frame mounted.
  // Not rotating there also spares a phone the data.
  const inViewport = useInView(ref, { margin: '-100px' });
  const pageVisible = usePageVisible();

  // Latches, so the section's entrance plays once and doesn't replay on every
  // return to the tab.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (inViewport) setEntered(true);
  }, [inViewport]);

  const reducedMotion = usePrefersReducedMotion();
  const indices = useRotatingSlots(inViewport && pageVisible && reducedMotion === false);

  const words = HEADLINE.split(' ');

  return (
    <section className="bg-warm-white py-20 lg:py-28 overflow-hidden">
      <div ref={ref} className="w-[90%] md:w-[80%] mx-auto">
        {/* ── Row one — the statement ─────────────────────────────────── */}
        {/* Ranged left on phones, centred from md. Centred text needs a measure
            wide enough to hold several words a line; at 338px it does not, and
            three paragraphs of it leave a ragged left edge the eye has to hunt
            for on every return. Left is also how the rest of the page sets its
            headings, so the phone reading is the consistent one. */}
        <Ornament
          src="/logos/crescent-sun-rays.png"
          className="h-[72px] md:h-[84px] mb-8 lg:mb-10 md:mx-auto"
        />

        <motion.h2
          variants={headlineContainer}
          initial="hidden"
          animate={entered ? 'visible' : 'hidden'}
          aria-label={HEADLINE}
          className="font-display font-light text-ink text-left md:text-center text-3xl md:text-4xl lg:text-5xl leading-[1.12] tracking-[-0.01em] max-w-4xl md:mx-auto"
        >
          {words.map((word, i) => (
            <span key={`${word}-${i}`} aria-hidden>
              <span className="inline-block overflow-hidden align-baseline">
                <motion.span variants={headlineWord} className="inline-block will-change-transform">
                  {word}
                </motion.span>
              </span>
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={entered ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
          className="mt-8 lg:mt-10 max-w-3xl md:mx-auto space-y-6"
        >
          {t.intro.paragraphs.map((paragraph) => (
            <p
              key={paragraph.slice(0, 24)}
              className="font-body text-sm md:text-[15px] text-ink text-left md:text-center leading-[1.8]"
            >
              {paragraph}
            </p>
          ))}
        </motion.div>

        {/* ── Row two — the rotating arrangement ──────────────────────── */}
        <div className="relative mt-14 lg:mt-24">
          {/* A single drawn line threading the row together, desktop only —
              below that the frames are a scroll strip, and a fixed curve behind
              something that moves would just be a stray mark. */}
          <motion.svg
            aria-hidden
            className="hidden lg:block absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-40 z-0 pointer-events-none text-ink/20"
            viewBox="0 0 1000 160"
            fill="none"
            preserveAspectRatio="none"
          >
            <motion.path
              d="M0 120 C 160 40, 300 30, 430 90 S 720 170, 1000 60"
              stroke="currentColor"
              strokeWidth="1"
              pathLength={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={entered ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 2.2, ease: 'easeInOut', delay: 0.3 }}
            />
          </motion.svg>

          {/* Desktop centres and staggers the four frames. Below that the same
              markup becomes a snap-scrolling strip that starts on the
              container's left edge, in line with every other section, and runs
              off the right one. The asymmetry is the affordance: a frame cut by
              the screen edge says the row continues, where a tidy right margin
              says it has ended. The gutter being cancelled is exactly 5vw of
              viewport, 10vw from md, since the container is 90%/80% and centred. */}
          <div
            role="group"
            aria-label={t.intro.trackAria}
            className="
              relative z-10 flex items-center lg:items-start
              justify-start lg:justify-center gap-5 lg:gap-8
              overflow-x-auto lg:overflow-visible
              snap-x snap-proximity lg:snap-none
              [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
              -mr-[5vw] md:-mr-[10vw] lg:mr-0
            "
          >
            {SLOTS.map((slot, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                animate={entered ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 * i }}
                className={`relative flex-shrink-0 snap-center ${slot.width} ${slot.offset}`}
              >
                <div className={`relative ${slot.aspect} overflow-hidden shadow-sm`}>
                  {/* Both frames sit stacked while a swap is in flight, so the
                      outgoing photo dissolves into the incoming one instead of
                      blinking through the background. */}
                  <AnimatePresence initial={false}>
                    <motion.img
                      key={POOL[indices[i]]}
                      src={POOL[indices[i]]}
                      alt=""
                      aria-hidden
                      draggable={false}
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        opacity: { duration: 1.3, ease: 'easeInOut' },
                        scale: { duration: 3.2, ease: 'easeOut' },
                      }}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                    />
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
