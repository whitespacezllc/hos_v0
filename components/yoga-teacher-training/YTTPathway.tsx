'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useMessages } from 'next-intl';

// The training is a single phase: the 50-hour immersion, held in person at the
// house. One card carries it — the story on one side, and on the other the
// facts a prospect checks before anything else (when, where, how, how much
// study), set as a quiet index so the section reads at a glance. Below it, the
// line that says what completing it earns.
export function YTTPathway() {
  const t = useMessages().ytt.pathway;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="bg-warm-white py-20 lg:py-28">
      <div ref={ref} className="w-[90%] md:w-[80%] mx-auto">
        <div className="max-w-2xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15]"
          >
            {t.heading}
          </motion.h2>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.18 }}
          className="mt-14 lg:mt-16 bg-dark text-cream p-8 md:p-10 lg:p-14 lg:grid lg:grid-cols-12 lg:gap-16"
        >
          <div className="lg:col-span-7">
            <h3 className="font-display font-light text-cream text-2xl md:text-3xl leading-snug">
              {t.title}
            </h3>
            <p className="font-body text-sm md:text-base text-cream/75 leading-[1.8] mt-6 max-w-xl">
              {t.body}
            </p>
          </div>

          {/* Label beside value from sm up; stacked on narrow phones, where a
              label column would squeeze the values into ragged two-word lines. */}
          <dl className="lg:col-span-5 mt-10 lg:mt-0 border-t border-cream/15">
            {t.facts.map((fact) => (
              <div
                key={fact.label}
                className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6 py-4 border-b border-cream/15"
              >
                <dt className="font-body text-xs text-cream/60 sm:w-24 shrink-0">{fact.label}</dt>
                <dd className="font-body text-sm text-cream leading-[1.6]">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </motion.article>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.4 }}
          className="mt-10 lg:mt-12 border-l-2 border-burgundy pl-6 md:pl-8 max-w-3xl"
        >
          <p className="font-body text-sm md:text-base text-ink leading-[1.8]">
            {t.certBefore}
            <span className="text-burgundy">{t.certHighlight}</span>
            {t.certAfter}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
