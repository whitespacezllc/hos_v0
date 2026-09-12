'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { motion, Variants, useInView } from 'framer-motion';
import { format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import type { YogaClass } from '@/types';
import { dateFnsLocale } from '@/lib/dates';
import { costaRicaWeekDays, inCostaRica, nowInCostaRica } from '@/lib/costa-rica-time';
import { weekTouchesStudioPause } from '@/lib/studio-pause';
import { Navigation } from '@/components/landing/navigation';
import { Footer } from '@/components/landing/footer';
import { ClassPacks } from '@/components/yoga/ClassPacks';
import { SpecialActivities } from '@/components/yoga/SpecialActivities';
import { OnlineClasses } from '@/components/yoga/OnlineClasses';
import { YogaTestimonials } from '@/components/yoga/YogaTestimonials';
import { MeetOurTeam } from '@/components/yoga/MeetOurTeam';
import { YogaFAQ } from '@/components/yoga/YogaFAQ';
import { HeroVideo, heroCuts } from '@/components/shared/HeroVideo';

// ─── Refined earth-tone category palette ─────────────────────────────────────
// Only the top stripe carries the category color. Card surface stays cream/
// transparent so the schedule reads as one quiet object, not a rainbow grid.
// The label of each category lives in the catalogue under yoga.categories.
const CATEGORY_STYLES = {
  'flow-vinyasa':     { stripe: '#8B6F47' }, // warm terracotta-brown
  'yin-restorative':  { stripe: '#6B7355' }, // muted olive
  'hatha-gentle':     { stripe: '#A6896D' }, // sand
  'ashtanga-intense': { stripe: '#5A3E2B' }, // deep earth — for intensity
  'meditation':       { stripe: '#7A6B5D' }, // warm gray
} as const;

type CategoryKey = keyof typeof CATEGORY_STYLES;

// Untouched — maps existing class names to category keys. DO NOT remove entries.
// The names compared here are the ones stored in the database, exactly as
// written there ('Pranayama & Meditación' included); they are never
// translated. What the reader sees is the category's label from the
// catalogue, looked up at render time.
function getCategoryKey(name: string): CategoryKey {
  if (['Sunrise Vinyasa', 'Power Flow', 'Breath & Movement', 'Vinyasa Flow', 'Vinyasa Krama', 'Detox Yoga'].includes(name)) return 'flow-vinyasa';
  if (['Yin Yoga', 'Yin & Restore', 'Restorative Yoga', 'Deep Stretch & Breath'].includes(name)) return 'yin-restorative';
  if (['Gentle Flow', 'Hatha Foundations'].includes(name)) return 'hatha-gentle';
  if (['Ashtanga Primary'].includes(name)) return 'ashtanga-intense';
  if (['Pranayama & Meditación', 'Meditation', 'Tantra Vinyasa'].includes(name)) return 'meditation';
  return 'flow-vinyasa';
}

// ─── Types & helpers ─────────────────────────────────────────────────────────
type SerializedClass = Omit<YogaClass, 'startsAt'> & { startsAt: string };

// The schedule is Santa Teresa's: its days, its week and its clock are Costa
// Rica's, whether the reader is in Madrid, Buenos Aires or Los Angeles. Every
// date here is built through lib/costa-rica-time so date-fns reads it in that
// zone, and the class instants are compared against those days.
function getWeekDays(weekOffset: number): Date[] {
  return costaRicaWeekDays(weekOffset);
}

function formatTime(iso: string): string {
  return format(inCostaRica(iso), 'HH:mm');
}

// ─── Headline word-by-word reveal variants ───────────────────────────────────
const headlineContainer: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.18, delayChildren: 0.1 } },
};
const headlineWord: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
};

// ═════════════════════════════════════════════════════════════════════════════
// HERO — editorial video, same pattern as home (full-bleed mobile, 80% desktop)
// ═════════════════════════════════════════════════════════════════════════════
function YogaHero() {
  return (
    <section className="bg-warm-white">
      {/*
        Hero + navbar together fill exactly 100vh.
        Mobile: full-bleed. Desktop: 80% container with margins.
        mt-* offsets the fixed navbar so the hero sits *below* it.
      */}
      <div className="w-full md:w-[80%] mx-auto mt-16 md:mt-20">
        <div
          className="
            relative overflow-hidden bg-dark
            h-[calc(100svh-4rem)] md:h-[calc(100svh-5rem)]
          "
        >
          <HeroVideo {...heroCuts('yoga', { portrait: 1.0 })} />
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// NARRATIVE — adapted for the Yoga page (no trailing image)
// The claim, the sentence under it and the four tracked labels live in the
// catalogue under yoga.narrative. The labels stay labels rather than a
// sentence: a reader scanning for "is there an online option?" finds it here
// without reading a paragraph to get there.
// ═════════════════════════════════════════════════════════════════════════════
function YogaNarrative() {
  const t = useTranslations('yoga.narrative');
  const labels = useMessages().yoga.narrative.labels;
  const textRef = useRef<HTMLDivElement | null>(null);
  const textInView = useInView(textRef, { once: true, margin: '-100px' });

  const headline = t('headline');
  const words = headline.split(' ');

  return (
    <section className="bg-warm-white py-20 lg:py-28 overflow-hidden">
      <div ref={textRef} className="w-[90%] md:w-[80%] mx-auto">
        <div className="max-w-3xl">
          {/* The page's only h1. The hero above it is a silent video with no
              copy, so until now the document opened with no heading at all. */}
          <motion.h1
            variants={headlineContainer}
            initial="hidden"
            animate={textInView ? 'visible' : 'hidden'}
            aria-label={headline}
            className="font-display font-light text-ink text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-[-0.01em]"
          >
            {words.map((word, i) => (
              <span
                key={`${word}-${i}`}
                aria-hidden
                className="inline-block overflow-hidden align-baseline"
              >
                <motion.span
                  variants={headlineWord}
                  className="inline-block will-change-transform"
                >
                  {word}
                  {/* non-breaking space — a regular ASCII space gets collapsed when each word is wrapped in inline-block */}
                  {i < words.length - 1 ? '\u00A0' : ''}
                </motion.span>
              </span>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={textInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 1.8 }}
            className="font-body text-ink max-w-2xl text-sm leading-[1.7] mt-12 lg:mt-16"
          >
            {t('body')}
          </motion.p>

          {/* No rule and no container: the labels sit straight on the page and
              are held by space alone. `gap-y` carries the wrap on a phone,
              where four tracked labels don't fit one line. */}
          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={textInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 2.1 }}
            className="flex flex-wrap items-center gap-x-3 md:gap-x-5 gap-y-3 mt-10 lg:mt-12"
          >
            {labels.map((label, i) => (
              <li key={label} className="flex items-center gap-3 md:gap-5">
                {i > 0 && (
                  <span aria-hidden className="h-3 w-px bg-ink/25 select-none" />
                )}
                <span className="font-body text-[10px] md:text-[11px] tracking-[0.2em] md:tracking-[0.28em] uppercase text-ink/80">
                  {label}
                </span>
              </li>
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CLASS CARD
// ═════════════════════════════════════════════════════════════════════════════
function ClassCard({ clase }: { clase: SerializedClass }) {
  const t = useTranslations('yoga.calendar.card');
  const router = useRouter();
  const catKey = getCategoryKey(clase.name);
  const cat = CATEGORY_STYLES[catKey];
  const past = new Date(clase.startsAt).getTime() <= Date.now();
  const sold = clase.spotsRemaining === 0;
  const disabled = sold || past;
  const fewLeft = !disabled && clase.spotsRemaining > 0 && clase.spotsRemaining < clase.capacity * 0.5;

  return (
    <article
      onClick={disabled ? undefined : () => router.push(`/booking/${clase.id}`)}
      className={`
        group relative border border-ink/10 bg-warm-white
        transition-[transform,border-color,box-shadow] duration-300 ease-out
        ${disabled
          ? 'opacity-40 pointer-events-none'
          : 'cursor-pointer hover:-translate-y-[2px] hover:border-ink/30 hover:shadow-[0_6px_16px_-4px_rgba(49,49,49,0.08)]'}
      `}
    >
      {/* Top stripe — the only place the category color appears */}
      <div className="h-[3px] w-full" style={{ background: cat.stripe }} aria-hidden />

      <div className="p-3 lg:p-4">
        <p className="font-display font-light text-ink text-base lg:text-lg leading-none">
          {formatTime(clase.startsAt)}
        </p>

        <p className="font-body text-[10px] tracking-[0.1em] uppercase text-ink mt-2">
          {clase.instructor}
        </p>

        <p className="font-body text-sm text-ink font-medium mt-1 leading-snug">
          {clase.name}
        </p>

        <div className="flex items-baseline justify-between mt-3">
          <span className="font-body text-[10px] text-ink">
            {t('minutes', { count: clase.durationMinutes })}
          </span>
          {past ? (
            <span className="font-body text-[10px] text-ink/50">
              {t('past')}
            </span>
          ) : sold ? (
            <span className="font-body text-[10px] text-ink">
              {t('fullyBooked')}
            </span>
          ) : fewLeft ? (
            <span className="font-body text-[10px] text-burgundy">
              {t('spotsLeft', { count: clase.spotsRemaining })}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// WEEKLY CALENDAR
// ═════════════════════════════════════════════════════════════════════════════
function WeeklyCalendar({ initialClasses }: { initialClasses: SerializedClass[] }) {
  const t = useTranslations('yoga.calendar');
  const locale = dateFnsLocale(useLocale());
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekClasses, setWeekClasses] = useState<SerializedClass[]>(initialClasses);
  const [loadingWeek, setLoadingWeek] = useState(false);

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const sectionInView = useInView(sectionRef, { once: true, margin: '-100px' });

  const today = nowInCostaRica();

  // "Mon 7" / "lun 7" — the pattern is the catalogue's, the words are date-fns'.
  const dayLabel = (day: Date) => {
    const label = format(day, t('dayFormat'), { locale });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  // The shala's pause belongs to the weeks it covers, so the notice follows
  // the week on screen rather than today's date: the last week of classes
  // stays clear of it, and every week of the pause carries it over the empty
  // grid. lib/studio-pause.ts holds both dates.
  const pauseNoticeVisible = weekTouchesStudioPause(weekDays);

  // "September 7 – 13" / "7 – 13 de septiembre": each language keeps its own
  // order of day and month, so the patterns come from the catalogue too.
  const weekLabel = (() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (!start || !end) return '';
    const sameMonth = start.getMonth() === end.getMonth();
    return t('weekRange', {
      start: format(start, sameMonth ? t('weekSameMonthStart') : t('weekOtherMonth'), { locale }),
      end: format(end, sameMonth ? t('weekSameMonthEnd') : t('weekOtherMonth'), { locale }),
    });
  })();

  async function navigateWeek(offset: number) {
    setWeekOffset(offset);
    setLoadingWeek(true);
    try {
      const days = getWeekDays(offset);
      const start = format(days[0], 'yyyy-MM-dd');
      const end = format(days[6], 'yyyy-MM-dd');
      const res = await fetch(`/api/classes/week?start=${start}&end=${end}`);
      const data = await res.json();
      setWeekClasses(data.classes ?? []);
    } catch {
      setWeekClasses([]);
    } finally {
      setLoadingWeek(false);
    }
  }

  const displayClasses = useMemo(
    () => weekClasses.filter((c) => c.isActive && weekDays.some((d) => isSameDay(inCostaRica(c.startsAt), d))),
    [weekClasses, weekDays],
  );

  // Group classes by day, sorted by start time
  const classesByDay = useMemo(() => {
    return weekDays.map((day) =>
      displayClasses
        .filter((c) => isSameDay(inCostaRica(c.startsAt), day))
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    );
  }, [displayClasses, weekDays]);

  return (
    // Anchor target for the online-classes CTA: those classes are booked on
    // this same schedule, so the button scrolls here rather than opening a
    // second surface. scroll-mt clears the fixed navbar, or the heading lands
    // tucked underneath it.
    <section
      ref={sectionRef}
      id="schedule"
      className="bg-warm-white py-20 lg:py-28 scroll-mt-20 lg:scroll-mt-24"
    >
      <div className="w-[90%] md:w-[80%] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={sectionInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
        >
          <h2 className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15]">
            {t('heading')}
          </h2>

          {/* The pause. Between the heading and the week, so a reader looking
              for next week's classes meets it before the empty grid does. */}
          {pauseNoticeVisible && (
            <div className="mt-8 lg:mt-10 max-w-2xl border border-burgundy/40 bg-burgundy/[0.04] px-6 py-6 lg:px-8 lg:py-7">
              <p className="font-body text-[10px] tracking-[0.2em] uppercase text-burgundy">
                {t('pause.eyebrow')}
              </p>
              <p className="font-display font-light text-ink text-xl lg:text-2xl leading-snug mt-3">
                {t('pause.line1')}
              </p>
              <p className="font-body text-base text-ink leading-relaxed mt-2">
                {t('pause.line2')}
              </p>
            </div>
          )}

          {/* Week navigation row */}
          <div className="flex items-center justify-between mt-8 lg:mt-10">
            <div className="flex items-center gap-4 lg:gap-6">
              <button
                onClick={() => navigateWeek(weekOffset - 1)}
                aria-label={t('previousWeek')}
                className="text-ink hover:opacity-70 transition-opacity duration-300"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1} />
              </button>
              <p className="font-body text-sm text-ink tracking-[0.05em] min-w-[12rem] text-center lg:text-left">
                {weekLabel}
              </p>
              <button
                onClick={() => navigateWeek(weekOffset + 1)}
                aria-label={t('nextWeek')}
                className="text-ink hover:opacity-70 transition-opacity duration-300"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1} />
              </button>
            </div>

            <div className="hidden md:flex items-center gap-4">
              {weekOffset !== 0 && (
                <button
                  onClick={() => navigateWeek(0)}
                  className="font-body text-xs italic text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300"
                >
                  {t('backToThisWeek')}
                </button>
              )}
              <span className="font-body text-xs italic text-ink">
                {loadingWeek
                  ? t('loading')
                  : weekOffset === 0
                    ? t('thisWeek')
                    : weekOffset > 0
                      ? t('upcoming')
                      : t('past')}
              </span>
            </div>
          </div>
        </motion.div>

        <p className="font-body text-xs text-ink/60 mt-6">{t('timezone')}</p>

        {/* DESKTOP — 7 column day grid */}
        <div className="hidden lg:grid grid-cols-7 gap-x-2 lg:gap-x-4 mt-12 lg:mt-16">
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            const dayClasses = classesByDay[i];
            return (
              <div key={i}>
                <div
                  className={`pb-4 border-b ${isToday ? 'border-burgundy' : 'border-ink/10'}`}
                >
                  <p
                    className={`font-display text-base lg:text-lg leading-none ${isToday ? 'text-burgundy' : 'text-ink'}`}
                  >
                    {dayLabel(day)}
                  </p>
                </div>
                <div className="flex flex-col gap-y-3 lg:gap-y-4 mt-4">
                  {dayClasses.length === 0 ? (
                    <p className="font-body text-xs italic text-ink/30 text-center mt-6">
                      {t('noClasses')}
                    </p>
                  ) : (
                    dayClasses.map((c) => <ClassCard key={c.id} clase={c} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* MOBILE — stacked day-by-day */}
        <div className="lg:hidden mt-12 space-y-12">
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            const dayClasses = classesByDay[i];
            if (dayClasses.length === 0) return null;
            return (
              <div key={i}>
                <h3
                  className={`font-display font-light text-lg pb-3 border-b ${isToday ? 'text-burgundy border-burgundy' : 'text-ink border-ink/10'}`}
                >
                  {dayLabel(day)}
                </h3>
                <div className="flex flex-col gap-y-3 mt-4">
                  {dayClasses.map((c) => <ClassCard key={c.id} clase={c} />)}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// YOGA GALLERY — Aman-style horizontal slider (Amanera reference)
//
// Distinct from the home Gallery (masonry).
// - Each slot has the SAME WIDTH; images keep their own aspect ratio so each
//   one renders at a DIFFERENT HEIGHT. The flex container vertically centers
//   them, giving the "uneven" editorial rhythm.
// - As the user scrolls, the image closest to the viewport center is shown
//   at full opacity; images further away fade progressively. Opacity is
//   recomputed on every scroll/resize.
// - Drag-to-scroll, native snap-proximity, scroll-smooth on release.
// - Progress bar lives inside the standard 80% container.
// ═════════════════════════════════════════════════════════════════════════════
type GalleryImg = { src: string; aspect: string; alt: string };

// Alt texts describe the photographs, which are the same in every language;
// they stay here rather than in the catalogue.

// Every `aspect` below is the file's real ratio on disk, within a rounding of
// well under half a percent — except 18 (1519×1926 = 0.789), which is declared
// as 4/5 and so gives up about 1.4% of its height. The nearer Tailwind step,
// 3/4, would cost 5%. Slots share a
// width and let the aspect set the height, so a mismatch here crops the photo.
//
// Order is deliberate, not numeric. Nine of the nineteen are 2:3, and a numeric
// run would stack them into a flat wall of identical heights. The shorter
// formats — the two landscapes (13, 17), the square (05), the 4:5 (18) and the
// 3:4s — are interleaved so the rail alternates tall/short on almost every slot.
// The one unavoidable short-short pair (13 then 19, since nine tall frames
// cannot separate ten short ones) is placed where the contrast is widest:
// a 3:2 landscape against a 3:4 portrait.
const yogaGalleryImages: GalleryImg[] = [
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-03.webp', aspect: 'aspect-[2/3]',  alt: 'Practice in the shala' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-13.webp', aspect: 'aspect-[3/2]',  alt: 'The practice space, wide' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-19.webp', aspect: 'aspect-[3/4]',  alt: 'A held posture' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-08.webp', aspect: 'aspect-[2/3]',  alt: 'Movement in soft light' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-05.webp', aspect: 'aspect-square', alt: 'A detail of the practice' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-09.webp', aspect: 'aspect-[2/3]',  alt: 'Standing practice' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-04.webp', aspect: 'aspect-[3/4]',  alt: 'A moment of stillness' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-01.webp', aspect: 'aspect-[2/3]',  alt: 'Practice in the shala' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-18.webp', aspect: 'aspect-[4/5]',  alt: 'Resting between postures' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-15.webp', aspect: 'aspect-[2/3]',  alt: 'A seated posture' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-11.webp', aspect: 'aspect-[3/4]',  alt: 'Practice on the mat' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-02.webp', aspect: 'aspect-[2/3]',  alt: 'A balancing posture' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-17.webp', aspect: 'aspect-[3/2]',  alt: 'The shala, wide' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-07.webp', aspect: 'aspect-[2/3]',  alt: 'Movement in soft light' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-06.webp', aspect: 'aspect-[3/4]',  alt: 'A quiet moment of practice' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-10.webp', aspect: 'aspect-[2/3]',  alt: 'An extended posture' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-12.webp', aspect: 'aspect-[3/4]',  alt: 'Practice on the mat' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-16.webp', aspect: 'aspect-[2/3]',  alt: 'A detail of the practice' },
  { src: '/images/yoga/carrete-yoga-wellbeing/yoga-wellbeing-14.webp', aspect: 'aspect-[3/4]',  alt: 'Practice in the shala' },
];

function YogaGallery({ galleryAria }: { galleryAria: string }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  // Aman-style thumb: fixed width = visible fraction of total content, slides left→right
  const [thumbWidth, setThumbWidth] = useState(100);
  const [thumbLeft, setThumbLeft] = useState(0);

  // Per-slot opacity, driven by distance from the visible viewport center
  const [opacities, setOpacities] = useState<number[]>(() =>
    yogaGalleryImages.map(() => 1),
  );

  // Drag-to-scroll refs (no re-renders)
  const isDragging = useRef(false);
  const dragMoved = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);

  const update = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;

    // Progress bar
    if (scrollWidth <= clientWidth) {
      setThumbWidth(100);
      setThumbLeft(0);
    } else {
      const widthPct = (clientWidth / scrollWidth) * 100;
      const max = scrollWidth - clientWidth;
      const leftPct = (scrollLeft / max) * (100 - widthPct);
      setThumbWidth(widthPct);
      setThumbLeft(leftPct);
    }

    // Per-slot opacity by distance to the visible center
    const viewportCenter = scrollLeft + clientWidth / 2;
    const slots = el.querySelectorAll<HTMLElement>('[data-gallery-slot]');
    const next: number[] = [];
    slots.forEach((slot) => {
      const slotCenter = slot.offsetLeft + slot.offsetWidth / 2;
      const dist = Math.abs(slotCenter - viewportCenter);
      // Within a 60% half-viewport window: opacity ≈ 1. Beyond: fade to ~0.3.
      const ratio = Math.min(1, dist / (clientWidth * 0.6));
      next.push(1 - ratio * 0.7);
    });
    setOpacities(next);
  };

  useEffect(() => {
    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    dragMoved.current = false;
    dragStartX.current = e.pageX;
    dragStartScrollLeft.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
    el.style.scrollSnapType = 'none';
    el.style.scrollBehavior = 'auto';
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const delta = e.pageX - dragStartX.current;
    if (Math.abs(delta) > 5) dragMoved.current = true;
    el.scrollLeft = dragStartScrollLeft.current - delta;
  };

  const endDrag = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const el = scrollRef.current;
    if (!el) return;
    el.style.cursor = 'grab';
    el.style.scrollBehavior = 'smooth';
    el.style.scrollSnapType = 'x proximity';
  };

  return (
    <section
      ref={sectionRef}
      aria-label={galleryAria}
      className="bg-warm-white py-20 lg:py-28"
    >
      {/*
        Full-bleed scroll. The container has a fixed height tall enough to
        accommodate the tallest aspect; flex items-center vertically centers
        shorter ones, producing the "uneven" rhythm.

        The tallest aspect is now 2:3, so a slot renders at width × 1.5 — taller
        than the 3:4 (× 1.333) this rail was originally sized for. Required
        height per breakpoint, against the slot widths set below:
          base 260 × 1.5 = 390  → h-[420px]  ok
          sm   320 × 1.5 = 480  → was 480, flush to the pixel → h-[520px]
          lg   400 × 1.5 = 600  → was 600, flush to the pixel → h-[640px]
          xl   440 × 1.5 = 660  → was 640, overflowed by 20px → h-[700px]
        Each breakpoint now carries ~40px of slack so rounding cannot clip.
      */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        ref={scrollRef}
        onScroll={update}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        tabIndex={0}
        className="
          flex items-center gap-6 lg:gap-10
          h-[420px] sm:h-[520px] lg:h-[640px] xl:h-[700px]
          overflow-x-auto snap-x snap-proximity scroll-smooth
          px-6 lg:px-16 xl:px-24
          cursor-grab select-none
          [scrollbar-width:none]
          [-ms-overflow-style:none]
          [&::-webkit-scrollbar]:hidden
          focus:outline-none
        "
      >
        {yogaGalleryImages.map((img, i) => (
          <div
            key={img.src}
            data-gallery-slot
            style={{
              opacity: opacities[i] ?? 1,
              transition: 'opacity 600ms ease-out',
            }}
            className="
              flex-shrink-0 snap-center
              w-[260px] sm:w-[320px] lg:w-[400px] xl:w-[440px]
            "
          >
            <div className={`w-full ${img.aspect} overflow-hidden`}>
              <img
                src={img.src}
                alt={img.alt}
                draggable={false}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover pointer-events-none"
              />
            </div>
          </div>
        ))}
      </motion.div>

      {/* Progress bar — Aman style, contained within the standard 80% */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.0, ease: 'easeOut', delay: 0.6 }}
        className="w-[90%] md:w-[80%] mx-auto mt-16 lg:mt-20"
      >
        <div className="relative h-px w-full bg-ink/15">
          <div
            className="absolute top-0 h-px bg-ink transition-[left,width] duration-300 ease-out"
            style={{ width: `${thumbWidth}%`, left: `${thumbLeft}%` }}
            aria-hidden
          />
        </div>
      </motion.div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════════════════════
export default function YogaPageClient({ initialClasses }: { initialClasses: SerializedClass[] }) {
  const t = useTranslations('yoga');
  return (
    <main id="main-content" className="bg-warm-white overflow-hidden">
      <Navigation />
      <YogaHero />
      <YogaNarrative />
      <WeeklyCalendar initialClasses={initialClasses} />
      {/* Packs sit outside the calendar now: they carry their own section and
          container, and the offer is about a habit rather than about this
          particular week. */}
      <ClassPacks />
      <SpecialActivities />
      <OnlineClasses />
      {/* Three guests, in their own words — the full-height treatment from the
          training landing, one photograph per voice. */}
      <YogaTestimonials />
      <MeetOurTeam />
      <YogaFAQ />
      <YogaGallery galleryAria={t('galleryAria')} />
      <Footer />
    </main>
  );
}
