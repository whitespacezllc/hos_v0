'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence, Variants, useInView } from 'framer-motion';
import { useMessages } from 'next-intl';

// Module text lives in the dictionary (both languages); only the fixed
// numerals live here, zipped with it by index at render.
const MODULE_NUMBERS = ['01', '02', '03', '04', '05', '06'];

type CurriculumModule = {
  n: string;
  title: string;
  focus: string;
  points: string[];
};

const list: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const row: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
};
const pointsList: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const point: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

/**
 * Plus that becomes a minus: the upright stroke turns a quarter and fades,
 * leaving the bar behind it.
 *
 * Deliberately a minus and not the cross the FAQ uses further down the page. A
 * cross reads as dismiss — it belongs on something that goes away. These rows
 * collapse and can be opened again, and plus/minus is the one pairing nobody
 * has to think about.
 */
function PlusMinus({ open }: { open: boolean }) {
  const ease = [0.22, 1, 0.36, 1] as const;
  return (
    <span aria-hidden className="relative block h-3.5 w-3.5 shrink-0">
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
      <motion.span
        className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current origin-center"
        initial={false}
        animate={{ rotate: open ? 90 : 0, opacity: open ? 0 : 1 }}
        transition={{ duration: 0.45, ease }}
      />
    </span>
  );
}

function Module({
  mod,
  open,
  onToggle,
}: {
  mod: CurriculumModule;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `module-panel-${mod.n}`;
  const buttonId = `module-button-${mod.n}`;

  return (
    <motion.article variants={row} className="border-t border-cream/15">
      <h3>
        <button
          id={buttonId}
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="group w-full flex items-start gap-5 md:gap-8 py-7 lg:py-8 text-left cursor-pointer"
        >
          <span
            aria-hidden
            className={`font-display font-light text-xl lg:text-2xl leading-none pt-0.5 shrink-0 w-8 transition-colors duration-300 ${
              open ? 'text-cream/70' : 'text-cream/35 group-hover:text-cream/60'
            }`}
          >
            {mod.n}
          </span>

          <span className="flex-1 min-w-0">
            <span className="block font-display font-light text-cream text-xl lg:text-2xl leading-snug">
              {mod.title}
            </span>
            {/* Below md the metadata sits under the title; from md it moves out
                to its own column on the right, where it lines up into a legible
                index down the edge of the section. */}
            <span className="block md:hidden font-body text-[11px] tracking-[0.15em] uppercase text-cream/55 mt-2">
              {mod.focus}
            </span>
          </span>

          <span className="hidden md:block shrink-0 font-body text-[11px] tracking-[0.15em] uppercase text-cream/55 text-right pt-1.5">
            {mod.focus}
          </span>

          <span
            className={`shrink-0 pt-2 transition-colors duration-300 ${
              open ? 'text-cream' : 'text-cream/50 group-hover:text-cream'
            }`}
          >
            <PlusMinus open={open} />
          </span>
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.35, ease: 'easeInOut' },
            }}
            className="overflow-hidden"
          >
            <motion.ul
              variants={pointsList}
              initial="hidden"
              animate="visible"
              className="pb-8 lg:pb-10 space-y-3 md:pl-13 max-w-3xl"
            >
              {mod.points.map((entry) => (
                <motion.li key={entry} variants={point} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-cream/50"
                  />
                  <span className="font-body text-sm text-cream/80 leading-[1.7]">{entry}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export function YTTCurriculum() {
  const t = useMessages().ytt;
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const modules: CurriculumModule[] = t.curriculum.modules.map((mod, i) => ({
    n: MODULE_NUMBERS[i],
    ...mod,
  }));

  // A set rather than a single index: someone comparing two modules should be
  // able to hold both open. The first starts open so the row's behaviour is
  // visible without having to guess that it opens at all.
  const [openModules, setOpenModules] = useState<string[]>([MODULE_NUMBERS[0]]);

  const toggle = (n: string) =>
    setOpenModules((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  return (
    <section ref={ref} data-surface="dark" className="bg-dark text-cream py-20 lg:py-28">
      <div className="w-[90%] md:w-[80%] mx-auto">
        <div className="max-w-2xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            className="font-display font-light text-cream text-3xl md:text-4xl leading-[1.15]"
          >
            {t.curriculum.heading}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
            className="font-body text-sm text-cream/70 leading-[1.8] mt-6"
          >
            {t.curriculum.sub}
          </motion.p>
        </div>

        {/* One column, not two. An accordion laid out in columns shifts its
            neighbour every time a row opens, so the thing you were about to
            read moves out from under you. */}
        <motion.div
          variants={list}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="mt-14 lg:mt-16 border-b border-cream/15"
        >
          {modules.map((mod) => (
            <Module
              key={mod.n}
              mod={mod}
              open={openModules.includes(mod.n)}
              onToggle={() => toggle(mod.n)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
