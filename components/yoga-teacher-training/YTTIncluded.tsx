'use client';

import { useRef } from 'react';
import { motion, Variants, useInView } from 'framer-motion';
import { useMessages } from 'next-intl';

const listContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
};

export function YTTIncluded() {
  const t = useMessages().ytt;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="bg-warm-white py-20 lg:py-28">
      <div ref={ref} className="w-[90%] md:w-[80%] mx-auto lg:grid lg:grid-cols-2 lg:gap-20">
        {/* Included */}
        <div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15]"
          >
            {t.included.heading}
          </motion.h2>

          <motion.ul
            variants={listContainer}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="mt-10 space-y-4"
          >
            {t.included.items.map((item) => (
              <motion.li
                key={item}
                variants={listItem}
                className="flex gap-4 border-b border-ink/10 pb-4"
              >
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-burgundy" />
                <span className="font-body text-sm text-ink leading-[1.6]">{item}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        {/* Not included — promoted from an uppercase eyebrow to a real heading,
            mirroring the left column. The list is meaningless without it. */}
        <div className="mt-16 lg:mt-0">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15]"
          >
            {t.included.notHeading}
          </motion.h2>

          <motion.ul
            variants={listContainer}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="mt-10 space-y-4"
          >
            {t.included.notItems.map((item) => (
              <motion.li
                key={item}
                variants={listItem}
                className="flex gap-4 border-b border-ink/10 pb-4"
              >
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink/40" />
                <span className="font-body text-sm text-ink leading-[1.6]">{item}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
