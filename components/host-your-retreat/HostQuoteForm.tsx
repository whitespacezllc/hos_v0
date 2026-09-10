'use client';

import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Flower2,
  Waves,
  GraduationCap,
  Wind,
  Music,
  Droplets,
  Spool,
  MoonStar,
  Palette,
  Ellipsis,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { intlTag } from '@/lib/dates';
import { whatsappUrl } from '@/lib/whatsapp';

// ─── Request a quote ─────────────────────────────────────────────────────────
// The page's ask. A retreat is priced on three things — what it is, when it
// is, and how many are coming — so those are the three questions, and nothing
// else: name, email and a message box would only be the WhatsApp conversation
// written out in advance. Nothing here is typed: every answer is a tap on a
// chip, so on a phone the whole form is four thumbs' worth of choosing. The
// answers compose the opening line of that conversation as they are given,
// in whichever language the reader is reading, and the button hands it to
// WhatsApp already written. Exact dates and head counts are what the
// conversation itself is for; a month, a length and a bracket are enough to
// quote a season and a house.
//
// Every question takes up to three answers, not one. A host's retreat is
// often two things at once — yoga and tantra, breathwork and sound — and a
// host who hasn't fixed a date yet has two or three months in mind, not one;
// a form that made them pick would be asking for a certainty they came here
// to get. Three is enough room for "one of these" without turning the chips
// into a survey. The message lists what was chosen the way the language
// would say it: what a retreat *is* joins with "and", the months, lengths and
// sizes it could be with "or".
//
// Every word — chip labels, legends, and each line of the message — comes
// from the catalogue under hostYourRetreat.quote. The message lines are ICU
// templates ("• Group size: {people}"), never pieces glued together, so each
// language phrases its own sentence.
//
// The house's general number, via lib/whatsapp — the same door the floating
// button's "Host Your Retreat" entry opens.

// What a retreat can be. The first six are the owners' list; the rest are the
// kinds of gathering that actually come to Santa Teresa, so a host finds
// their own without reaching for "Other". Each carries a thin lucide mark —
// the same family the rest of the site's controls draw from.
const KINDS = [
  { id: 'yoga', icon: Flower2 },
  { id: 'surfYoga', icon: Waves },
  { id: 'teacherTraining', icon: GraduationCap },
  { id: 'breathwork', icon: Wind },
  { id: 'soundHealing', icon: Music },
  { id: 'aguahara', icon: Droplets },
  { id: 'macrame', icon: Spool },
  { id: 'tarot', icon: MoonStar },
  { id: 'creative', icon: Palette },
  { id: 'other', icon: Ellipsis },
] as const;

// How long. Brackets rather than a count: a host planning a retreat knows
// "about a week" long before they know the nights.
const LENGTHS = ['3to4', '5to6', '7', '8plus'] as const;

// How many. The brackets follow the house: Main House sleeps ten, the three
// dwellings together around fifteen, and beyond twenty is a conversation
// about the whole property. Each bracket knows how to say itself in a
// sentence — "up to 6 people", "7–10 people", "more than 20 people".
const GROUPS = [
  { id: 'upTo6', people: { shape: 'upTo', n: 6 } },
  { id: '7to10', people: { shape: 'range', from: 7, to: 10 } },
  { id: '11to14', people: { shape: 'range', from: 11, to: 14 } },
  { id: '15to20', people: { shape: 'range', from: 15, to: 20 } },
  { id: 'moreThan20', people: { shape: 'moreThan', n: 20 } },
] as const;

type KindId = (typeof KINDS)[number]['id'];
type LengthId = (typeof LENGTHS)[number];
type GroupId = (typeof GROUPS)[number]['id'];

const FLEXIBLE = 'flexible';

// How many answers one question takes.
const MAX_PICKS = 3;

type Answers = {
  kinds: KindId[];
  /** Months as YYYY-MM, or FLEXIBLE on its own. */
  months: string[];
  lengths: LengthId[];
  groups: GroupId[];
};

const EMPTY: Answers = { kinds: [], months: [], lengths: [], groups: [] };

const LABEL = 'block font-body text-[10px] tracking-[0.25em] uppercase text-ink/70';
const HINT = 'font-body text-xs text-ink/75 leading-[1.7] mt-2';

type Option = { id: string; icon?: LucideIcon; label: string };

// The next twelve months from today, as YYYY-MM keys.
function upcomingMonths(from: Date, count = 12): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

// The months on offer are read on the client only, once, so the server and
// the hydrating render agree on the markup (no month chips) whatever month
// or timezone either is in, and the reader's own calendar fills them in
// right after. An external-store read rather than an effect that sets
// state: same timing, one render fewer, and nothing to clean up.
const NO_MONTHS: string[] = [];
let monthsOnThisDevice: string[] | null = null;
const readMonths = () => (monthsOnThisDevice ??= upcomingMonths(new Date()));
const readNoMonths = () => NO_MONTHS;
const subscribeToNothing = () => () => {};

// "March 2027" / "Marzo 2027" — the chip and the message use the same words.
function monthLabel(key: string, tag: string): string {
  const [y, m] = key.split('-').map(Number);
  const name = new Intl.DateTimeFormat(tag, { month: 'long' }).format(new Date(y, m - 1, 1));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

// "Flexible dates" answers the month question by itself: picked, it lets go
// of any months; a month picked after it lets go of it.
function reconcileFlexible(prev: string[], next: string[]): string[] {
  const added = next.find((id) => !prev.includes(id));
  if (added === FLEXIBLE) return [FLEXIBLE];
  if (added) return next.filter((id) => id !== FLEXIBLE);
  return next;
}

// The chosen ids in the order the chips show them, whatever order they were
// tapped in — so the message reads "March, April or May", never the reverse.
function inChipOrder<Id extends string>(options: readonly { id: Id }[], picked: readonly Id[]): Id[] {
  return options.filter((o) => picked.includes(o.id)).map((o) => o.id);
}

// "Yoga, breathwork and sound healing" / "March, April or May" — the list
// the language would write, with its own separators and conjunction. The
// formatter is in every browser this site supports; the fallback is for the
// odd one that lacks it, and only loses the last "and".
function listPhrase(tag: string, items: string[], type: 'conjunction' | 'disjunction'): string {
  if (items.length < 2) return items.join('');
  if (typeof Intl.ListFormat === 'function') {
    return new Intl.ListFormat(tag, { type, style: 'long' }).format(items);
  }
  return items.join(', ');
}

type Translate = ReturnType<typeof useTranslations<'hostYourRetreat.quote'>>;

function composeMessage(t: Translate, tag: string, a: Answers, monthOptions: readonly Option[]): string {
  const lines: string[] = [];

  const kinds = inChipOrder(KINDS, a.kinds).map((id) => t(`kinds.${id}`));
  if (kinds.length) lines.push(t('message.retreatLine', { kind: listPhrase(tag, kinds, 'conjunction') }));

  const when: string[] = [];
  const months = inChipOrder(monthOptions, a.months).map((id) =>
    id === FLEXIBLE ? t('message.flexibleDates') : monthLabel(id, tag),
  );
  if (months.length) when.push(listPhrase(tag, months, 'disjunction'));
  const lengths = inChipOrder(
    LENGTHS.map((id) => ({ id })),
    a.lengths,
  ).map((id) => t(`lengths.${id}`).toLowerCase());
  if (lengths.length) when.push(listPhrase(tag, lengths, 'disjunction'));
  if (when.length) lines.push(t('message.whenLine', { when: when.join(', ') }));

  const groups = inChipOrder(GROUPS, a.groups).map((id) => {
    const { people } = GROUPS.find((g) => g.id === id)!;
    return people.shape === 'upTo'
      ? t('message.peopleUpTo', { n: people.n })
      : people.shape === 'moreThan'
        ? t('message.peopleMoreThan', { n: people.n })
        : t('message.peopleRange', { from: people.from, to: people.to });
  });
  if (groups.length) lines.push(t('message.groupLine', { people: listPhrase(tag, groups, 'disjunction') }));

  return [t('message.opening'), lines.join('\n'), t('message.closing')].filter(Boolean).join('\n\n');
}

// A legend sits on the fieldset's own top rule, which is exactly where the
// site's eyebrows sit — so the rule is the fieldset's border, and the label
// interrupts it. The right padding is the breath between the words and where
// the line resumes.
function Legend({ children }: { children: ReactNode }) {
  return <legend className={`${LABEL} pr-3`}>{children}</legend>;
}

// One row of choices, up to `max` of which can be down. Square, hairline, and
// a chosen one inverts to ink — the same states the track arrows and the
// lightbox thumbnails already use. Tapping a chosen chip lets go of it. Once
// the question has all the answers it takes, the rest step back — dimmed and
// marked unavailable, still where they were — until one is let go of; a chip
// that changed the answer behind the reader's back would be worse than one
// that waits.
function Chips<Id extends string>({
  options,
  values,
  max = MAX_PICKS,
  onChange,
}: {
  options: readonly (Option & { id: Id })[];
  values: readonly Id[];
  max?: number;
  onChange: (next: Id[]) => void;
}) {
  const full = values.length >= max;
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const selected = values.includes(option.id);
        const blocked = full && !selected;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            aria-disabled={blocked || undefined}
            onClick={() => {
              if (blocked) return;
              onChange(selected ? values.filter((v) => v !== option.id) : [...values, option.id]);
            }}
            className={`flex items-center gap-2.5 border px-4 py-2.5 font-body text-[13px] leading-none transition-colors duration-300 ${
              selected
                ? 'border-ink bg-ink text-cream'
                : blocked
                  ? 'border-ink/10 text-ink/35 cursor-not-allowed'
                  : 'border-ink/25 text-ink hover:border-ink'
            }`}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.25} aria-hidden />}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function HostQuoteForm() {
  const t = useTranslations('hostYourRetreat.quote');
  const tag = intlTag(useLocale());
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  // The months on offer start from today — see readMonths.
  const months = useSyncExternalStore(subscribeToNothing, readMonths, readNoMonths);

  const kindOptions = KINDS.map((k) => ({ id: k.id, icon: k.icon, label: t(`kinds.${k.id}`) }));
  const lengthOptions = LENGTHS.map((id) => ({ id, label: t(`lengths.${id}`) }));
  const groupOptions = GROUPS.map((g) => ({ id: g.id, label: t(`groups.${g.id}`) }));
  const monthOptions = useMemo<Option[]>(
    () => [
      { id: FLEXIBLE, label: t('flexible') },
      ...months.map((key) => ({ id: key, label: monthLabel(key, tag) })),
    ],
    [months, t, tag],
  );

  const message = useMemo(
    () => composeMessage(t, tag, answers, monthOptions),
    [t, tag, answers, monthOptions],
  );
  const href = whatsappUrl(message);

  return (
    <section id="quote" className="bg-warm-white py-20 lg:py-28 scroll-mt-20 lg:scroll-mt-28">
      <div ref={ref} className="w-[90%] md:w-[80%] mx-auto lg:grid lg:grid-cols-3 lg:gap-12">
        {/* ── Left — the invitation ───────────────────────────────────── */}
        <div className="lg:col-span-1 lg:pr-12">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            className="font-display font-light text-ink text-3xl md:text-4xl leading-[1.15]"
          >
            {t('heading')}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
            className="font-body text-sm text-ink leading-relaxed mt-6 lg:mt-10 max-w-full lg:max-w-xs"
          >
            {t('intro')}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.3 }}
            className="font-body text-xs text-ink/75 leading-[1.7] mt-8 lg:mt-10 max-w-full lg:max-w-xs"
          >
            {t('responseTime')}
          </motion.p>
        </div>

        {/* ── Right — the three questions ────────────────────────────── */}
        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.15 }}
          className="lg:col-span-2 mt-12 lg:mt-0"
          // Enter does what the button does: the form has no server, only the link.
          onSubmit={(e) => {
            e.preventDefault();
            window.open(href, '_blank', 'noopener,noreferrer');
          }}
        >
          {/* What */}
          <fieldset className="min-w-0 border-t border-ink/10 pt-8 pb-10">
            <Legend>{t('what')}</Legend>
            <p className={HINT}>{t('whatHint')}</p>
            <div className="mt-5">
              <Chips options={kindOptions} values={answers.kinds} onChange={(v) => set('kinds', v)} />
            </div>
          </fieldset>

          {/* When */}
          <fieldset className="min-w-0 border-t border-ink/10 pt-8 pb-10">
            <Legend>{t('when')}</Legend>
            <p className={HINT}>{t('whenHint')}</p>
            <div className="mt-5 space-y-6">
              <div>
                <p className={LABEL}>{t('month')}</p>
                <div className="mt-3">
                  <Chips
                    options={monthOptions}
                    values={answers.months}
                    onChange={(v) => set('months', reconcileFlexible(answers.months, v))}
                  />
                </div>
              </div>
              <div>
                <p className={LABEL}>{t('length')}</p>
                <div className="mt-3">
                  <Chips options={lengthOptions} values={answers.lengths} onChange={(v) => set('lengths', v)} />
                </div>
              </div>
            </div>
          </fieldset>

          {/* How many */}
          <fieldset className="min-w-0 border-t border-ink/10 pt-8 pb-10">
            <Legend>{t('howMany')}</Legend>
            <p className={HINT}>{t('howManyHint')}</p>
            <div className="mt-5">
              <Chips options={groupOptions} values={answers.groups} onChange={(v) => set('groups', v)} />
            </div>
          </fieldset>

          {/* The door */}
          <div className="border-t border-ink/10 pt-8 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block self-start bg-dark text-cream font-body text-sm tracking-[0.05em] px-8 py-3.5 hover:bg-burgundy transition-colors duration-300"
            >
              {t('cta')}
            </a>
            <p className="font-body text-xs text-ink/75 leading-[1.7]">{t('ctaNote')}</p>
          </div>
        </motion.form>
      </div>
    </section>
  );
}
