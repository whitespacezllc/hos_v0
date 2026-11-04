'use client';

import { useState, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import { motion, AnimatePresence, Variants, useInView } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useMessages, useTranslations } from 'next-intl';
import { SHALA_POLICY_PATH } from '@/lib/shala-policy';

// FAQ content — copy provided by the client for the yoga and wellness page,
// in the catalogue under yoga.faq.items.

// Stagger variants for the list children
const listContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

// ─── FAQ Item — controlled accordion row ────────────────────────────────────
function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
  index,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  // Namespaced against the accommodations FAQ ids in case both accordions
  // ever share a page.
  const buttonId = `yoga-faq-button-${index}`;
  const panelId = `yoga-faq-panel-${index}`;

  return (
    <motion.li
      variants={itemVariants}
      className={`border-b border-ink/10 ${index === 0 ? 'border-t' : ''}`}
    >
      <button
        type="button"
        id={buttonId}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full flex justify-between items-center gap-6 py-6 lg:py-8 cursor-pointer text-left group"
      >
        <span className="font-display font-light text-ink text-lg lg:text-xl leading-snug">
          {question}
        </span>
        <motion.span
          aria-hidden
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex-shrink-0 text-ink group-hover:opacity-70 transition-opacity duration-300"
        >
          <Plus className="w-4 h-4" strokeWidth={1} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.4, ease: 'easeOut' },
              opacity: { duration: 0.3, ease: 'easeOut', delay: 0.1 },
            }}
            className="overflow-hidden"
          >
            <p className="font-body text-sm text-ink leading-relaxed max-w-3xl pb-6 lg:pb-8">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// YOGA FAQ — "Questions before you book?"
// Accordion behavior: one item open at a time. Replaces the earlier centered
// contact block; the contact invitation survives below the list, so a reader
// whose question is not answered here still has a way out.
// ═════════════════════════════════════════════════════════════════════════════
export function YogaFAQ() {
  const t = useTranslations('yoga.faq');
  const faqs = useMessages().yoga.faq.items;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });

  const toggle = (i: number) => setOpenIndex((current) => (current === i ? null : i));

  return (
    <section className="bg-warm-white py-20 lg:py-28">
      <div ref={sectionRef} className="w-[90%] md:w-[80%] max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
          className="font-display font-light text-ink text-3xl md:text-4xl leading-tight mb-16 lg:mb-20"
        >
          {t('heading')}
        </motion.h2>

        <motion.ul
          variants={listContainer}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          {faqs.map((faq, i) => (
            <FAQItem
              key={faq.question}
              index={i}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === i}
              onToggle={() => toggle(i)}
            />
          ))}
        </motion.ul>

        {/* Escape hatch for questions the list does not cover. Delayed past the
            staggered list so it reads as a closing note, not a tenth row. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.4 }}
          className="mt-12 lg:mt-16"
        >
          <p className="font-body text-sm text-ink max-w-md leading-relaxed">
            {t('outro')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mt-6">
            <Link
              href="/contact"
              className="font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300"
            >
              {t('cta')}
            </Link>
            <Link
              href={SHALA_POLICY_PATH}
              className="font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300"
            >
              {t('policyLink')}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
