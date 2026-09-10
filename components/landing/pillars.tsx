"use client";

import { motion, Variants, useInView } from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from '@/i18n/navigation';
import { Ornament } from "@/components/shared/ornament";

// The three doors, in order. Titles and descriptions live in the catalogue
// under home.pillars.items, keyed by `id`.
const pillars = [
  { id: "retreats", image: "/images/seccion3/card_retreats.webp", link: "/retreats" },
  { id: "stay", image: "/images/seccion3/card_accommodations.webp", link: "/stay-with-us" },
  { id: "yoga", image: "/images/yoga/NE8A7702%201.webp", link: "/yoga" },
] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 1.0,
      ease: "easeOut",
    },
  },
};

export function Pillars() {
  const t = useTranslations("home.pillars");
  const tButtons = useTranslations("common.buttons");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="pillars"
      ref={ref}
      className="bg-warm-white pt-6 lg:pt-8 pb-20 lg:pb-28"
    >
      <div className="w-[90%] md:w-[80%] mx-auto">
        {/* Section heading — single line, restrained */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: "easeOut" }}
          className="text-center mb-16 lg:mb-20"
        >
          {/* Kundalini serpent — the Shakti energy, above the world of Shakti */}
          <Ornament src="/logos/snake-sun-rays.png" className="h-[104px] md:h-[124px] mx-auto mb-6 lg:mb-8" />

          <h2 className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15]">
            {t("heading")}
          </h2>
        </motion.div>

        {/* Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid md:grid-cols-3 gap-8 lg:gap-10"
        >
          {pillars.map((pillar) => (
            <motion.article key={pillar.id} variants={itemVariants} className="h-full">
              {/* Entire card is one link — image, title, description, CTA all clickable */}
              <Link href={pillar.link} className="group flex h-full flex-col">
                {/* Image — static, no hover zoom */}
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    src={pillar.image}
                    alt=""
                    aria-hidden
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                {/* Text block.
                    The three descriptions run to different lengths — four lines,
                    two, three — so left to stack naturally each "Discover more"
                    landed at its own height and the row read as ragged. The
                    column grows to the tallest card in the row (the grid already
                    stretches its items), the paragraph takes the slack, and the
                    link is pushed to the floor, so the three line up. */}
                <div className="mt-6 lg:mt-8 flex flex-1 flex-col">
                  <h3 className="font-display font-light text-ink text-lg lg:text-xl leading-snug mb-3 lg:mb-4">
                    {t(`items.${pillar.id}.title`)}
                  </h3>

                  <p className="font-body text-sm text-ink leading-relaxed mb-6 lg:mb-8">
                    {t(`items.${pillar.id}.description`)}
                  </p>

                  <span className="mt-auto font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] transition-opacity duration-300 group-hover:opacity-70 self-start">
                    {tButtons("discoverMore")}
                  </span>
                </div>
              </Link>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
