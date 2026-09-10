'use client';

import { useCallback, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { motion, useInView } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Testimonial carousel ────────────────────────────────────────────────────
// The full-height treatment built for the training landing (QuoteBreak's
// testimonial variant), carried across several voices: one photograph per
// guest, the words centred in it, a crossfade between them.
//
// Nothing advances on its own. The longest quote here takes the better part of
// a minute to read, and a slide that moves on before its last line is worse
// than one the reader has to ask for — so the controls, a swipe, and the
// arrow keys are the only ways through.
//
// Every slide is laid out in the same grid cell, so the band takes the height
// of the tallest quote and keeps it: switching testimonials never shifts the
// sections below, and the controls stay where the hand left them.

export type TestimonialSlide = {
  quote: string;
  author: string;
  role?: string;
  /** Landscape cut, and optionally a portrait one for phones (≤ 767px). */
  image: { desktop: string; mobile?: string };
  /**
   * Black scrim opacity over this photograph. Measured, never guessed, and
   * measured per tile under the quote's own box at each breakpoint — it is
   * the brightest patch that decides whether a line is readable, not the
   * mean. See the notes beside each entry in the caller.
   */
  scrim?: number;
};

export type TestimonialLabels = {
  /** Accessible name of the whole band. */
  region: string;
  previous: string;
  next: string;
  /** Accessible name of one slide, 1-based. */
  slide: (n: number, total: number) => string;
};

// Carries the remaining margin so the scrim doesn't have to be darkened
// further and lose the photograph behind it. Uniform, like the scrim — every
// line is held at the same weight.
const TEXT_SHADOW = '[text-shadow:0_1px_2px_rgba(0,0,0,0.35),0_2px_18px_rgba(0,0,0,0.28)]';

// A horizontal drag this long steps the carousel. Shorter, or steeper than
// it is wide, is the page being scrolled and is left alone.
const SWIPE_MIN_PX = 48;

const CONTROL =
  'h-11 w-11 flex items-center justify-center text-cream/70 hover:text-cream transition-colors duration-300 cursor-pointer';

export function TestimonialCarousel({
  slides,
  labels,
  className = '',
}: {
  slides: TestimonialSlide[];
  labels: TestimonialLabels;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const [current, setCurrent] = useState(0);
  const total = slides.length;

  const goTo = useCallback((i: number) => setCurrent(((i % total) + total) % total), [total]);
  const prev = () => goTo(current - 1);
  const next = () => goTo(current + 1);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) next();
    else prev();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    }
  };

  return (
    <section
      ref={ref}
      aria-roledescription="carousel"
      aria-label={labels.region}
      className={`bg-warm-white ${className}`}
    >
      {/* Full width on every breakpoint. The rest of the page holds an 80%
          container, but this one moment is the photograph, and insetting it
          would frame a quotation as though it were another block of content. */}
      <div className="w-full">
        {/* Height follows the longest quote and only then a minimum, never the
            other way around: pinning it to a viewport height would put a long
            testimonial at risk of being clipped on a short window or a large
            accessibility font size. Neutral black under the photographs, never
            `--dark`, which is a burgundy and would cast over every frame. */}
        <div
          data-surface="dark"
          data-testimonials
          className="relative overflow-hidden bg-black min-h-[75vh] md:min-h-[80vh] grid"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {slides.map((slide, i) => {
            const active = i === current;
            const shown = active && inView;
            const scrim = slide.scrim ?? 0.55;
            return (
              <motion.div
                key={`${i}-${slide.author}`}
                role="group"
                aria-roledescription="slide"
                aria-label={labels.slide(i + 1, total)}
                aria-hidden={!active}
                data-slide
                data-scrim={scrim}
                initial={false}
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className={`[grid-area:1/1] relative flex items-center ${active ? '' : 'pointer-events-none'}`}
              >
                <picture>
                  {slide.image.mobile && (
                    <source media="(max-width: 767px)" srcSet={slide.image.mobile} />
                  )}
                  <motion.img
                    src={slide.image.desktop}
                    alt=""
                    aria-hidden
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    initial={{ scale: 1.06 }}
                    animate={inView ? { scale: 1 } : { scale: 1.06 }}
                    transition={{ duration: 2.4, ease: 'easeOut' }}
                    className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                  />
                </picture>

                {/* An even wash rather than a bottom-weighted gradient: the
                    quote sits in the middle of the frame, and a gradient would
                    run light under one line and heavy under the next. */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ backgroundColor: `rgba(0,0,0,${scrim})` }}
                />

                {/* The bottom padding is also the room the controls stand in. */}
                <div className="relative w-[85%] md:w-[80%] mx-auto py-28 md:py-32">
                  <figure className={`max-w-3xl mx-auto text-center ${TEXT_SHADOW}`}>
                    <motion.div
                      initial={false}
                      animate={shown ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                      className="h-px w-16 bg-cream/40 mx-auto origin-center"
                    />

                    <motion.blockquote
                      initial={false}
                      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                      transition={{ duration: 1.2, ease: 'easeOut', delay: shown ? 0.15 : 0 }}
                      // Restrained for its length. The page's other display
                      // type runs large because it is a handful of words; a
                      // few hundred characters set that way becomes a wall to
                      // climb rather than a voice to listen to.
                      className="font-display font-light text-cream text-xl md:text-2xl lg:text-[28px] leading-[1.55] tracking-[-0.005em] text-balance mt-10 md:mt-12"
                    >
                      &ldquo;{slide.quote}&rdquo;
                    </motion.blockquote>

                    <motion.figcaption
                      initial={false}
                      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                      transition={{ duration: 1.0, ease: 'easeOut', delay: shown ? 0.45 : 0 }}
                      className="mt-10 md:mt-12"
                    >
                      <span className="block font-body text-[11px] md:text-xs tracking-[0.28em] uppercase text-cream/85">
                        {slide.author}
                      </span>
                      {slide.role && (
                        <span className="block font-body text-[11px] md:text-xs tracking-[0.18em] uppercase text-cream/60 mt-2">
                          {slide.role}
                        </span>
                      )}
                    </motion.figcaption>
                  </figure>
                </div>
              </motion.div>
            );
          })}

          {/* Controls: a chevron either side of one hairline per voice, the
              same hairline that opens each quote. They sit inside the band's
              bottom padding, so they never cross the last line of the longest
              testimonial. */}
          {total > 1 && (
            <div
              className="absolute inset-x-0 bottom-6 md:bottom-8 z-10 flex items-center justify-center gap-4"
              onKeyDown={onKeyDown}
            >
              <button type="button" onClick={prev} aria-label={labels.previous} className={CONTROL}>
                <ChevronLeft className="h-5 w-5" strokeWidth={1} aria-hidden />
              </button>
              <div className="flex items-center gap-3">
                {slides.map((slide, i) => {
                  const active = i === current;
                  return (
                    <button
                      key={`dot-${i}-${slide.author}`}
                      type="button"
                      data-dot
                      onClick={() => goTo(i)}
                      aria-label={labels.slide(i + 1, total)}
                      aria-current={active ? 'true' : undefined}
                      className="group py-3 px-0.5 cursor-pointer"
                    >
                      <span
                        aria-hidden
                        className={`block h-px w-8 transition-colors duration-500 ${
                          active ? 'bg-cream' : 'bg-cream/35 group-hover:bg-cream/70'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={next} aria-label={labels.next} className={CONTROL}>
                <ChevronRight className="h-5 w-5" strokeWidth={1} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
