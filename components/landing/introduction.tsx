"use client";

import { motion, useInView, Variants } from "framer-motion";
import { useRef } from "react";
import { Ornament } from "@/components/shared/ornament";

const HEADLINE = "We are not in the business of more.";

// Container drives the per-word stagger. Children fade + rise.
const headlineVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.18,
      delayChildren: 0.1,
    },
  },
};

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
  },
};

export function Introduction() {
  const textRef = useRef(null);
  const textInView = useInView(textRef, { once: true, margin: "-100px" });

  const imageRef = useRef(null);
  const imageInView = useInView(imageRef, { once: true, margin: "-100px" });

  const words = HEADLINE.split(" ");

  return (
    <section className="bg-warm-white py-20 lg:py-28 overflow-hidden">
      {/* Text block — left aligned, breathing container */}
      <div
        ref={textRef}
        className="max-w-5xl mx-auto px-6 lg:px-12"
      >
        {/* Brand seal — celestial submark opening the narrative */}
        <Ornament src="/logos/crescent-sun-rays.png" className="h-[84px] md:h-[104px] mx-auto mb-10 lg:mb-14" />

        <motion.h2
          variants={headlineVariants}
          initial="hidden"
          animate={textInView ? "visible" : "hidden"}
          aria-label={HEADLINE}
          className="font-display font-light text-ink max-w-4xl text-5xl md:text-6xl lg:text-7xl leading-[1.1] tracking-[-0.01em]"
        >
          {words.map((word, i) => (
            <span
              key={`${word}-${i}`}
              aria-hidden
              className="inline-block overflow-hidden align-baseline"
            >
              <motion.span
                variants={wordVariants}
                className="inline-block will-change-transform"
              >
                {word}
                {i < words.length - 1 ? " " : ""}
              </motion.span>
            </span>
          ))}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={textInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 1.8 }}
          className="font-body text-ink max-w-2xl text-base md:text-lg leading-[1.8] mt-12 lg:mt-16"
        >
          House of Shakti was built around a quieter idea — that travel can
          return you to yourself rather than take you further away. Here,
          between the jungle and the sea of Santa Teresa, three rituals hold
          the rhythm of each day: practice, rest, and presence.
        </motion.p>
      </div>
    </section>
  );
}
