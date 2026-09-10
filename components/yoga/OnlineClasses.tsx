'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Ornament } from '@/components/shared/ornament';
import { usePrefersReducedMotion } from '@/hooks/use-media-query';
import { usePageVisible } from '@/hooks/use-page-visible';

// ─── Online Yoga Classes ─────────────────────────────────────────────────────
// The clip is the argument this section makes — it shows the room you would be
// practising into — so it leads and the words sit beside it. Three things had
// to hold at once: a 3:4 frame, a section no taller than the one it replaces,
// and a plate with real presence instead of the narrow slab it used to be. The
// last two pull against each other, because 3:4 is still a portrait: every
// pixel of width costs 1.33 of height. That rules out the obvious moves — a
// plate spanning the container, or copy laid over it — which at this width
// would stand past 900px tall and leave the section half again as tall.
//
// Bounding the plate on both axes at once is what resolves it. The track is
// clamp(324px, min(38vw, 54svh), 456px): the vw term takes the width that is
// going, the svh term refuses to let the frame outgrow the window it is read
// in, and the clamp keeps both ends sane. Measured, not estimated:
//
//   1920×1080 → 456×608   1440×900 → 456×608   1440×760 → 410×547
//   1180×820  → 443×590   1024×640 → 346×461    768 →  430×573
//   375       → 338×450
//
// Against the 346×614 plate this replaces at 1440, that is 32% more width and
// 30% more area while the box gets *shorter*, and the whole section comes in at
// 832px against 838px. On a short laptop the svh term takes over and the
// section stays around one screen; on a phone the column that carried a 599px
// 9:16 now carries a 450px 3:4.
//
// So presence here is proportion, not pixels. The plate holds 40% of the
// container instead of 30%, it is the only large mass in the section, and the
// copy no longer stretches to meet it — it is a compact block centred against
// the plate, which is also what stops the section reading as a tall corridor.
// Nothing is ruled or divided: the sequence is ornament, heading, sentence,
// button, footnote, and the separation comes from space, from the step down in
// size, and from the footnote's lighter ink.

const CLIP_SRC = '/videos/yoga-wellbeing/online-classes-video.mp4#t=0.1';

// One measure shared by the sentence and the small print so both land on the
// same right edge. Past xl the copy track grows past a thousand pixels; bounded
// here, the surplus reads as margin rather than as a line of text running on.
const MEASURE = 'max-w-md xl:max-w-lg';

export function OnlineClasses() {
  const t = useTranslations('yoga.online');
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });

  const plateRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [onScreen, setOnScreen] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  const pageVisible = usePageVisible();
  const reducedMotion = usePrefersReducedMotion();

  // The element is server-rendered with opacity-0, so the browser starts
  // fetching the clip while parsing the HTML — long before React commits the
  // hydration of a 700-line page. Media events do not queue: if loadedmetadata
  // has already fired by then, the handlers below never see it and the clip
  // stays invisible for good. Seeding from readyState closes that window; the
  // handlers still cover the case where loading has not finished yet.
  useEffect(() => {
    const el = videoRef.current;
    if (el && el.readyState >= 1) setFrameReady(true);
  }, []);

  // A clip decoding off screen costs exactly what a watched one costs, and this
  // section sits deep in a long page most readers scroll straight past.
  useEffect(() => {
    const el = plateRef.current;
    if (!el) return;

    // Without an observer there is no way to know the plate is being looked at.
    // Give up the saving rather than leave the frame frozen forever.
    if (typeof IntersectionObserver === 'undefined') {
      setOnScreen(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Asserted rather than assumed: a clip that reaches play() unmuted is
    // refused outright by the autoplay policy.
    el.muted = true;

    // `reducedMotion === false`, not `!reducedMotion`: the hook reports null
    // until it has a viewport to read, and null must not be taken for a no.
    // Under a real reduce preference play() is never called at all, which
    // leaves the clip resting on the frame the media fragment seeks to — which
    // is exactly the image this section needs to show anyway.
    if (onScreen && pageVisible && reducedMotion === false) {
      // Autoplay can still be refused — a data saver, a low-power mode. Swallow
      // it: the seeked frame is already painted and simply stays.
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [onScreen, pageVisible, reducedMotion]);

  // There is no poster file and none can be produced, so the clip's own first
  // frame serves as one and is faded up to avoid an empty box snapping to
  // image. Bound to `loadedmetadata` as well as `loadeddata`: the former always
  // fires under preload="metadata", so the video can never be stranded at zero
  // opacity by a browser that declines to decode a frame up front.
  const markReady = () => setFrameReady(true);

  return (
    <section className="bg-warm-white py-20 lg:py-28">
      <div
        ref={sectionRef}
        className="
          w-[90%] md:w-[80%] mx-auto
          grid grid-cols-1 gap-y-12
          lg:grid-cols-[clamp(324px,min(38vw,54svh),456px)_minmax(0,1fr)]
          lg:gap-x-14 xl:gap-x-16 lg:gap-y-0
          lg:items-center
        "
      >
        {/* The copy is one block on the desktop composition — centred against
            the plate as a single mass — but on a phone it has to open the
            section and then resume underneath the clip, so the reader meets the
            heading, the evidence, and the way in, in that order. `contents`
            gets both: below lg the two halves are grid items in their own right
            and `order` interleaves them with the plate; from lg up the wrapper
            becomes a real box again and simply stacks them. */}
        <div className="contents lg:flex lg:flex-col lg:col-start-2 lg:row-start-1">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
            className="order-1"
          >
            {/* Both neighbouring sections open on an ornament; this one keeps
                the rhythm and takes the mark neither of them uses. At h-8 it
                was a speck against a plate this size — at the size Introduction
                already gives it, it reads as the seal it is meant to be and
                gives the copy column a head of its own. */}
            <Ornament
              src="/logos/snake-sun-rays.png"
              className="h-[84px] md:h-[104px] mb-6 lg:mb-8"
            />

            <h2 className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15]">
              {t('heading')}
            </h2>

            <p className={`font-body text-sm text-ink leading-[1.7] mt-6 lg:mt-7 ${MEASURE}`}>
              {t('body')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.25 }}
            className="order-3 lg:mt-10"
          >
            {/* A plain anchor, not a router link: the target is this same page,
                `scroll-behavior: smooth` is already set globally, and the
                schedule section carries the scroll-mt that keeps its heading
                clear of the fixed navbar. */}
            <a
              href="#schedule"
              className="inline-block bg-dark text-cream font-body text-sm tracking-[0.05em] px-8 py-3.5 hover:bg-burgundy transition-colors duration-300"
            >
              {t('cta')}
            </a>

            {/* The practical footnote. Nothing rules it off from the button —
                the drop to text-xs and to ink/70 is the whole separation, and
                it is the difference between an instruction and an aside. */}
            <p className={`font-body text-xs text-ink/70 leading-[1.7] mt-6 ${MEASURE}`}>
              {t('note')}
            </p>
          </motion.div>
        </div>

        {/* ── Plate — the clip, and the subject of the section ────────────
            Width comes from the grid track on desktop; stacked, it takes the
            container up to a cap, so a tablet cannot hand a 3:4 box 600px of
            width and 800px of height. Left-aligned rather than centred while
            stacked, so the plate, the ornament, the heading and the button all
            share one left edge there. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
          className="
            order-2
            w-full max-w-[430px] lg:max-w-none
            lg:col-start-1 lg:row-start-1
          "
        >
          {/* The observer sits on this static box rather than on the animated
              parent, so the entrance transform never enters the intersection
              maths. */}
          <div
            ref={plateRef}
            className="relative w-full aspect-[3/4] overflow-hidden bg-ink/5"
          >
            <video
              ref={videoRef}
              // The #t=0.1 fragment makes the browser seek to that frame and
              // paint it while paused; without it Safari holds a black
              // rectangle until playback starts — which is most of the time,
              // since the clip only runs while it is on screen.
              src={CLIP_SRC}
              muted
              loop
              playsInline
              preload="metadata"
              // Decoration, not content: nothing to read, grab, or tab to, and
              // out of the accessibility tree. Everything this section means is
              // said in the text beside it.
              controls={false}
              disablePictureInPicture
              disableRemotePlayback
              aria-hidden
              tabIndex={-1}
              draggable={false}
              onLoadedMetadata={markReady}
              onLoadedData={markReady}
              // Anchored to the top, and this is the one decision in the
              // section that had to be made against the footage rather than by
              // eye. Cover scales the 608×1080 source by width, so the 3:4 box
              // keeps 608 × 4/3 = 810.67 of the 1080 rows and object-position
              // alone decides which 269.33 are thrown away. Sampling mean row
              // luminance at t = 0.1 / 1.5 / 3.0 / 4.5 / 5.9: the lit band —
              // the open wall, the garden, the teacher seated right of the axis
              // — runs 476–814 and never reaches lower, while everything below
              // row 810 sits at 26–52, bare polished floor for the whole clip.
              // Top anchoring spends the entire cut there and loses nothing.
              // The top cannot pay it: this is a push-in, and by the last
              // second the copper pendant cluster has climbed to the very top
              // of the frame — rendering 0%, 12%, 22% and 32% side by side on
              // the real frames, 12% already trims the crown of the cluster and
              // 32% takes the ridge with it, which on a symmetric architectural
              // shot is the first thing the eye checks.
              className={`absolute inset-0 h-full w-full object-cover object-top pointer-events-none select-none transition-opacity duration-700 ease-out ${
                frameReady ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}