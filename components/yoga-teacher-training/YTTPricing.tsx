'use client';

import { useRef } from 'react';
import { motion, Variants, useInView } from 'framer-motion';
import { Ornament } from '@/components/shared/ornament';
import { useMessages } from 'next-intl';
import { whatsappUrl } from '@/lib/whatsapp';

// All CTAs on this landing route to the house's WhatsApp — one number for
// the whole site, see lib/whatsapp.ts.

// Payment schedule and tier text live in the dictionary, in both languages.

// Which tier is visually featured is structural, not textual.
const TIER_FEATURED = [true, false, false];

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.14 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 1.0, ease: 'easeOut' } },
};

export function YTTPricing() {
  const t = useMessages().ytt;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section data-surface="dark" className="bg-dark text-cream py-20 lg:py-28">
      <div ref={ref} className="w-[90%] md:w-[80%] mx-auto">
        <div className="max-w-2xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            className="font-display font-light text-cream text-3xl md:text-4xl leading-[1.15]"
          >
            {t.pricing.heading}
          </motion.h2>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid md:grid-cols-3 gap-6 lg:gap-8 mt-14 lg:mt-16"
        >
          {t.pricing.tiers.map((tier, i) => (
            <motion.article
              key={tier.tag}
              variants={item}
              className={`p-8 md:p-10 flex flex-col ${
                TIER_FEATURED[i]
                  ? 'bg-cream text-dark'
                  : 'border border-cream/20 text-cream'
              }`}
            >
              <p
                className={`font-body text-[10px] tracking-[0.25em] uppercase ${
                  TIER_FEATURED[i] ? 'text-burgundy' : 'text-cream/60'
                }`}
              >
                {tier.tag}
              </p>
              <p className="font-display font-light text-3xl md:text-4xl mt-5">{tier.price}</p>
              <p
                className={`font-body text-sm leading-[1.7] mt-4 ${
                  TIER_FEATURED[i] ? 'text-dark/70' : 'text-cream/70'
                }`}
              >
                {tier.detail}
              </p>
            </motion.article>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.4 }}
          className="mt-12 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10"
        >
          <p className="font-body text-sm text-cream/70 leading-[1.7] max-w-md">
            {t.pricing.onlineLine}
          </p>
          <a
            href={whatsappUrl(t.whatsapp.messagePricing)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block shrink-0 bg-cream text-dark font-body text-sm tracking-[0.05em] px-8 py-3.5 hover:bg-burgundy hover:text-cream transition-colors duration-300"
          >
            {t.pricing.requestCta}
          </a>
        </motion.div>

        {/* Payment schedule + apply block */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
          className="mt-20 lg:mt-28 grid lg:grid-cols-2 gap-12 lg:gap-20 lg:items-center"
        >
          {/* Left — schedule */}
          <div className="lg:border-r lg:border-cream/15 lg:pr-20">
            <h3 className="font-display font-light text-cream text-3xl md:text-4xl leading-[1.15]">
              {t.pricing.paymentHeading}
            </h3>
            <ul className="mt-8 space-y-5">
              {t.pricing.schedule.map((line) => (
                <li key={line} className="flex gap-4">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-burgundy" />
                  <span className="font-body text-sm text-cream/85 leading-[1.7]">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — invitation + apply */}
          <div className="text-center">
            <Ornament src="/logos/moon-phase.png" className="h-[42px] md:h-12 mx-auto mb-8 opacity-80" />
            <p className="font-display font-light text-cream text-3xl md:text-4xl leading-[1.2] max-w-md mx-auto">
              {t.pricing.invitation}
            </p>
            <a
              href={whatsappUrl(t.whatsapp.message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-burgundy text-cream font-body text-sm tracking-[0.05em] px-10 py-3.5 hover:bg-cream hover:text-dark transition-colors duration-300 mt-10"
            >
              {t.pricing.applyCta}
            </a>
          </div>
        </motion.div>

        {/* Closing line */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.3 }}
          className="font-display font-light text-cream text-2xl md:text-3xl text-center mt-20 lg:mt-24"
        >
          {t.pricing.closing}
        </motion.p>
      </div>
    </section>
  );
}
