'use client';

import { motion } from 'framer-motion';
import { Ornament } from '@/components/shared/ornament';
import { WordReveal } from '@/components/about/WordReveal';
import { useMessages } from 'next-intl';

// ─── Opening ─────────────────────────────────────────────────────────────────
// No hero, no film. The page opens the way a letter does: the brand's
// hand-drawn mark and a first line — with the second beat of the same phrase
// a step down, the couplet Stay With Us gives its own intro. Mount-animated
// rather than scroll-triggered, since it sits at the top of the page. No
// dateline above the title: the page carries no eyebrows at all, on the
// owners' call.
export function AboutOpening() {
  const t = useMessages().about.opening;

  return (
    <section className="bg-warm-white pt-28 lg:pt-36 pb-12 lg:pb-16">
      <div className="w-[90%] md:w-[80%] mx-auto">
        <div className="max-w-3xl">
          <Ornament src="/logos/crescent-sun-rays.png" className="h-12 md:h-14 mb-8 lg:mb-10" />

          <WordReveal
            as="h1"
            text={t.title}
            active
            className="font-display font-light text-ink text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-[-0.01em]"
          />

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.9 }}
            className="font-display font-light text-ink/65 text-2xl md:text-3xl lg:text-4xl leading-[1.15] tracking-[-0.01em] mt-4 lg:mt-5"
          >
            {t.second}
          </motion.p>
        </div>
      </div>
    </section>
  );
}
