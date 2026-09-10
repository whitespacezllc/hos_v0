'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CalendarDays } from 'lucide-react';

// ─── Upcoming retreats ───────────────────────────────────────────────────────
// Facilitators bring their own retreats to the house, so each card hands the
// reader straight over to whoever is running it. The retreats themselves are
// managed in the panel (/admin/retreats) and arrive here already sorted and
// worded for the locale: what is coming, first-to-last, and — once anything
// has finished — what has been, under its own heading, most recent first. A
// past retreat keeps its card whole, door included: the facilitator's page is
// where the next edition will be announced.
export type RetreatCard = {
  id: string;
  /** What kind of thing this is, set over the photograph. */
  label: string;
  instructors: string;
  title: string;
  /** Written out for the locale: "Sep 6–12, 2026" / "6–12 sep 2026". */
  dates: string;
  description: string;
  image: string;
  alt: string;
  href: string;
  /** False for a page on this site, which opens in place rather than in a new tab. */
  external: boolean;
};

const CTA =
  'inline-block bg-dark text-cream font-body text-sm tracking-[0.05em] px-8 py-3.5 hover:bg-burgundy transition-colors duration-300';

function RetreatCardView({ retreat, delay }: { retreat: RetreatCard; delay: number }) {
  const t = useTranslations('upcomingRetreats');
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const cta = retreat.external ? (
    <a href={retreat.href} target="_blank" rel="noopener noreferrer" className={CTA}>
      {t('moreInfo')}
    </a>
  ) : (
    <Link href={retreat.href} className={CTA}>
      {t('moreInfo')}
    </Link>
  );

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 1.0, ease: 'easeOut', delay }}
      className="flex flex-col h-full"
    >
      <div className="relative aspect-[16/15] overflow-hidden bg-dark">
        <img
          src={retreat.image}
          alt={retreat.alt}
          draggable={false}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
        {/* Flush to the corner rather than inset — the photograph's own edge is
            the frame, and a floating chip would need a radius to look right. */}
        <span className="absolute left-0 top-0 bg-dark/85 font-body text-[10px] tracking-[0.22em] uppercase text-cream px-3.5 py-2">
          {retreat.label}
        </span>
      </div>

      <p className="font-body text-[11px] tracking-[0.22em] uppercase text-ink/60 mt-6">
        {retreat.instructors}
      </p>

      <h3 className="font-display font-light text-ink text-2xl lg:text-[1.75rem] leading-[1.15] mt-3">
        {retreat.title}
      </h3>

      <p className="flex items-center gap-2 font-body text-sm text-ink/70 mt-3">
        <CalendarDays aria-hidden className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
        <span>{retreat.dates}</span>
      </p>

      <p className="font-body text-sm text-ink leading-[1.8] mt-4">{retreat.description}</p>

      {/* Pushed to the bottom so the buttons line up across a row whose
          descriptions run to different lengths. */}
      <div className="mt-auto pt-7">{cta}</div>
    </motion.article>
  );
}

function CardGrid({ cards }: { cards: RetreatCard[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14 lg:gap-y-20 mt-14 lg:mt-20">
      {cards.map((retreat, i) => (
        <RetreatCardView key={retreat.id} retreat={retreat} delay={(i % 3) * 0.1} />
      ))}
    </div>
  );
}

function SectionHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  return (
    <motion.h2
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 1.0, ease: 'easeOut' }}
      className={`font-display font-light text-ink text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-[-0.01em] ${className}`}
    >
      {children}
    </motion.h2>
  );
}

export function UpcomingGrid({ upcoming, past }: { upcoming: RetreatCard[]; past: RetreatCard[] }) {
  const t = useTranslations('upcomingRetreats');

  return (
    <section className="bg-warm-white py-20 lg:py-28">
      <div className="w-[90%] md:w-[80%] mx-auto">
        <SectionHeading>{t('heading')}</SectionHeading>

        {upcoming.length > 0 ? (
          <CardGrid cards={upcoming} />
        ) : (
          <p className="font-body text-sm text-ink/70 leading-[1.8] mt-10 max-w-xl">{t('empty')}</p>
        )}

        {/* What has been. Its own heading, a line that says these may come
            round again, and the same cards — a rule above, and the room of a
            section break, so it reads as a second chapter rather than as the
            row above running on. */}
        {past.length > 0 && (
          <div className="mt-24 lg:mt-32 pt-16 lg:pt-20 border-t border-ink/10">
            <SectionHeading>{t('past.heading')}</SectionHeading>
            <p className="font-body text-sm text-ink/70 leading-[1.8] mt-6 max-w-xl">{t('past.subline')}</p>
            <CardGrid cards={past} />
          </div>
        )}
      </div>
    </section>
  );
}
