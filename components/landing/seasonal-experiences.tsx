"use client";

import { motion, Variants, useInView } from "framer-motion";
import { useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from '@/i18n/navigation';
import { Ornament } from "@/components/shared/ornament";
import { TrackArrows } from "@/components/shared/TrackArrows";
import { useCarousel } from "@/hooks/use-carousel";
import { useDragScroll } from "@/hooks/use-drag-scroll";

// The cards, in order. Their words live in the catalogue under
// home.featured.items, keyed by `id`.
const experiences = [
  { id: "shakti", image: "/images/seccionSeasonalExperiences/card_shakti_experience.webp", href: "/shakti-experience" },
  { id: "ytt", image: "/images/seccionSeasonalExperiences/yoga-teacher-training-nancy.webp", href: "/yoga-teacher-training" },
  { id: "couples", image: "/images/seccionSeasonalExperiences/card_couples.webp", href: "/stay-with-us" },
] as const;

const cardsContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.0, ease: "easeOut" },
  },
};

export function SeasonalExperiences() {
  const t = useTranslations("home.featured");
  const tButtons = useTranslations("common.buttons");
  const sectionRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  // Stepping the track, and knowing when it has reached either end. The track
  // stays a plain scroll container underneath, so dragging, swiping, the
  // trackpad and the keyboard all keep working — the arrows are a second way
  // in, not a replacement for any of them.
  const { trackRef, atStart, atEnd, step, hasOverflow } = useCarousel<HTMLDivElement>();

  // Drag-to-scroll — the shared hook, so this strip and the activities strip
  // on /stay-with-us pull identically.
  const { dragHandlers } = useDragScroll(trackRef);

  // Landing here directly at #seasonal-experiences — arriving from another
  // page via the nav link, or opening a shared link. Two problems to solve:
  //   1. The router's own hash handling goes through smooth scrolling, which
  //      some browsers drop outright, leaving the visitor at the top instead.
  //   2. Images above this section finish loading *after* we jump and shift
  //      the page, so the section slides out from under the viewport.
  // Hence: jump once the route settles, then realign after late layout shifts
  // — but only while the visitor hasn't scrolled away on their own.
  useEffect(() => {
    if (window.location.hash !== "#seasonal-experiences") return;

    let landedAt = -1;
    const jump = () => {
      const el = sectionRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "instant" as ScrollBehavior });
      landedAt = window.scrollY;
    };

    // Only fires if nothing else already moved us.
    const initial = window.setTimeout(() => {
      if (window.scrollY < 4) jump();
    }, 350);
    // Only fires if we're still parked where we landed.
    const realign = window.setTimeout(() => {
      if (landedAt >= 0 && Math.abs(window.scrollY - landedAt) < 8) jump();
    }, 1200);

    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(realign);
    };
  }, []);

  return (
    <section
      id="seasonal-experiences"
      ref={sectionRef}
      /* scroll-mt offsets the fixed navbar so a #seasonal-experiences jump
         doesn't land the heading underneath it. Sized against the compact
         navbar (h-14 mobile / h-20 desktop) plus a little air. */
      className="py-20 lg:py-28 bg-warm-white scroll-mt-20 lg:scroll-mt-24"
    >
      {/* Container global del proyecto: 90% mobile / 80% desktop */}
      <div className="w-[90%] md:w-[80%] mx-auto lg:grid lg:grid-cols-3 lg:gap-12">
        {/* LEFT — heading + intro + track controls */}
        <div className="lg:col-span-1 lg:pr-12">
          {/* Moon phases centered over the title — echoes the "Moon cycles" gathering */}
          <div className="w-fit">
            <Ornament src="/logos/moon-phase.png" className="h-[42px] md:h-12 mx-auto mb-5 lg:mb-6" />

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 1.0, ease: "easeOut" }}
              className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15]"
            >
              {t("heading")}
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: "easeOut", delay: 0.2 }}
            className="font-body text-sm text-ink leading-relaxed mt-6 lg:mt-10 max-w-full lg:max-w-xs"
          >
            {t("intro")}
          </motion.p>

          {/* Arrows sit with the copy, not floating over the cards, so they
              never cover a photograph or a title. Hidden outright when every
              card already fits — a pair of permanently dead controls teaches
              the reader that the section doesn't respond. */}
          {hasOverflow && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 1.0, ease: "easeOut", delay: 0.3 }}
              className="mt-8 lg:mt-10"
            >
              <TrackArrows
                atStart={atStart}
                atEnd={atEnd}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
              />
            </motion.div>
          )}
        </div>

        {/* RIGHT — horizontal scroll + progress bar */}
        <div className="lg:col-span-2 mt-12 lg:mt-0">
          {/* The track starts on the container's left edge, like every other
              section, and runs off the right one. That asymmetry is the whole
              affordance: a card cut by the screen edge says the row continues,
              where a tidy right margin says it has ended. The gutter cancelled
              here is exactly 5vw of viewport, 10vw from md, since the container
              is 90%/80% and centred. On desktop the track stays inside its
              column, where the cards are already visibly cut by the grid. */}
          <motion.div
            variants={cardsContainerVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            ref={trackRef}
            {...dragHandlers}
            tabIndex={0}
            aria-label={t("trackAria")}
            className="
              flex gap-6 lg:gap-8
              overflow-x-auto snap-x snap-proximity scroll-smooth
              cursor-grab select-none
              [scrollbar-width:none]
              [-ms-overflow-style:none]
              [&::-webkit-scrollbar]:hidden
              focus:outline-none
              -mr-[5vw] md:-mr-[10vw] lg:mr-0
            "
          >
            {experiences.map((exp) => (
              <motion.article
                key={exp.id}
                variants={cardVariants}
                className="
                  flex-shrink-0 snap-start
                  w-[80vw] max-w-[360px]
                  lg:w-[40vw] lg:max-w-[440px]
                "
              >
                {/* The titles run to one, two and three lines, so left to stack
                    naturally each "Discover more" landed at its own height.
                    The cards already stretch to the tallest in the row, so the
                    column takes that height, the description absorbs the slack
                    and the link is pushed to the floor: the three line up. */}
                <Link
                  href={exp.href}
                  className="group flex h-full flex-col"
                  draggable={false}
                >
                  {/* Image — square */}
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={exp.image}
                      alt=""
                      aria-hidden
                      draggable={false}
                      className="w-full h-full object-cover pointer-events-none"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>

                  <div className="flex flex-1 flex-col">
                    <h3 className="font-display font-light text-ink text-lg lg:text-xl leading-tight mt-3">
                      {t(`items.${exp.id}.title`)}
                    </h3>

                    <p className="font-body text-sm text-ink leading-relaxed mt-3 line-clamp-3">
                      {t(`items.${exp.id}.description`)}
                    </p>

                    <span className="mt-auto self-start font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] transition-opacity duration-300 group-hover:opacity-70 pt-6">
                      {tButtons("discoverMore")}
                    </span>
                  </div>
                </Link>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
