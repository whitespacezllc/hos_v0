'use client';

import { useRef } from 'react';
import { motion, Variants, useInView } from 'framer-motion';
import { WordReveal } from '@/components/about/WordReveal';

// ─── A chapter of the letter ─────────────────────────────────────────────────
// Two of these make the page: the founder, then the house. Each is a numeral,
// a photograph clipped beside the text, a handful of margin notes, the
// paragraphs in a narrow measure, and one line set large at the end — the
// sentence the chapter was written to arrive at. No eyebrow under the numeral:
// the page carries none, on the owners' call.
//
// On a desktop the photograph and the notes hold one side of the page and
// stay put while the prose scrolls past, as a photograph pinned to a page
// would; the chapters alternate sides so the two read as facing pages rather
// than as one column repeated. On a phone the numeral, the photograph and
// the notes come first, then the words.

export type ChapterCopy = {
  numeral: string;
  notes: string[];
  paragraphs: string[];
  pull: string;
  photoAlt: string;
};

const notesContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
};
const noteItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
};

export function AboutChapter({
  copy,
  photo,
  photoSide = 'left',
}: {
  copy: ChapterCopy;
  photo: string;
  /** Which side of the page the photograph and notes take from lg. */
  photoSide?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const aside = photoSide === 'left' ? 'lg:col-start-1' : 'lg:col-start-9';
  const main = photoSide === 'left' ? 'lg:col-start-6' : 'lg:col-start-1';

  return (
    <section className="bg-warm-white py-20 lg:py-28">
      <div
        ref={ref}
        className="w-[90%] md:w-[80%] mx-auto lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start"
      >
        {/* ── The margin: numeral, photograph, notes ────────────────────── */}
        <aside className={`lg:col-span-4 lg:row-start-1 ${aside}`}>
          <div className="lg:sticky lg:top-28">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
            >
              {/* The chapter mark — a numeral, as the design principles set
                  section dividers, in the display face so it reads as drawn. */}
              <p aria-hidden className="font-display font-light text-ink text-5xl md:text-6xl leading-none">
                {copy.numeral}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 1.0, ease: 'easeOut', delay: 0.15 }}
              className="relative aspect-[4/5] overflow-hidden bg-ink/5 mt-8 lg:mt-10 max-w-[300px] lg:max-w-none"
            >
              <img
                src={photo}
                alt={copy.photoAlt}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* Margin notes — the chapter in short, set as a list of dashes,
                the way the site already writes a room's facts. */}
            <motion.ul
              variants={notesContainer}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
              className="mt-8 lg:mt-10 space-y-2.5"
            >
              {copy.notes.map((note) => (
                <motion.li key={note} variants={noteItem} className="flex items-baseline gap-3">
                  <span aria-hidden className="font-body text-sm text-ink/50 select-none">
                    —
                  </span>
                  <span className="font-body text-sm text-ink/75 leading-relaxed">{note}</span>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </aside>

        {/* ── The words ───────────────────────────────────────────────── */}
        <div className={`lg:col-span-7 lg:row-start-1 ${main} mt-14 lg:mt-0`}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.25 }}
            className="max-w-2xl space-y-6"
          >
            {copy.paragraphs.map((paragraph) => (
              <p
                key={paragraph.slice(0, 32)}
                className="font-body text-[15px] md:text-base text-ink leading-[1.9]"
              >
                {paragraph}
              </p>
            ))}
          </motion.div>

          {/* The line the chapter arrives at, set as the site sets its
              opening statements — and written out word by word. */}
          <div className="mt-12 lg:mt-16 max-w-2xl">
            <WordReveal
              text={copy.pull}
              active={inView}
              className="font-display font-light text-ink text-3xl md:text-4xl lg:text-5xl leading-[1.15] tracking-[-0.01em]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
