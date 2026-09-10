'use client';

import { useState, useMemo } from 'react';
import { addMinutes, format } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Check, CheckCircle, XCircle, Loader2, CreditCard, Banknote, Smartphone,
} from 'lucide-react';
import type { Upsell, ReferralCode } from '@/types';
import { startBookingCheckout, type CheckoutError } from '@/app/actions/checkout';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { ClassPack } from '@/lib/queries/packs';
import type { AppLocale } from '@/i18n/routing';
import { dateFnsLocale } from '@/lib/dates';
import { inCostaRica } from '@/lib/costa-rica-time';
import { downloadICS } from '@/lib/ics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { BookingHeader } from '@/components/booking/BookingHeader';
import { BookingSummary } from '@/components/booking/BookingSummary';
import { BookingMobileSummary } from '@/components/booking/BookingMobileSummary';
import { BookingNavigation } from '@/components/booking/BookingNavigation';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';
import { VenmoModal } from '@/components/booking/VenmoModal';

// ── Class photo mapping ──────────────────────────────────────────────────────
const CLASS_PHOTOS: Record<string, string> = {
  'Sunrise Vinyasa':        '/images/yoga/NE8A7702%201.webp',
  'Power Flow':             '/images/yoga/IMG_8420%201.webp',
  'Yin Yoga':               '/images/yoga/IMG_7491%201.webp',
  'Restorative Yoga':       '/images/yoga/IMG_7526%201.webp',
  'Pranayama & Meditación': '/images/sanctuary/271A0873_websize%201.webp',
  'Breath & Movement':      '/images/yoga/IMG_8664%201.webp',
  'Gentle Flow':            '/images/yoga/IMG_7538%201.webp',
  'Hatha Foundations':      '/images/yoga/IMG_7539%201.webp',
  'Ashtanga Primary':       '/images/yoga/NE8A7854%201.webp',
  'Detox Yoga':             '/images/yoga/IMG_8420%201.webp',
  'Vinyasa Krama':          '/images/yoga/NE8A7702%201.webp',
  'Tantra Vinyasa':         '/images/yoga/IMG_7526%201.webp',
  'Deep Stretch & Breath':  '/images/yoga/IMG_7491%201.webp',
  'Vinyasa Flow':           '/images/yoga/IMG_8664%201.webp',
};
function getClassPhoto(name: string): string {
  return CLASS_PHOTOS[name] ?? '/images/yoga/IMG_8693%201.webp';
}

type Props = {
  classId: string;
  className: string;
  instructor: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  spotsRemaining: number;
  priceUsd: number;
  location: string;
  description: string;
  color?: string;
  imageUrl?: string;
  upsells: Upsell[];
  /** The class packs on sale, priced by the database — the same rows the checkout charges. */
  packs: ClassPack[];
  /** The language the flow renders in — stored with the booking so its emails speak it. */
  locale: AppLocale;
};

// The messages are the reader's — built inside the component, where the
// catalogue is at hand.
type FormErrors = { firstNameRequired: string; lastNameRequired: string; emailInvalid: string };

const personalSchema = (errors: FormErrors) =>
  z.object({
    firstName: z.string().min(1, errors.firstNameRequired),
    lastName: z.string().min(1, errors.lastNameRequired),
    email: z.string().email(errors.emailInvalid),
    phone: z.string().optional(),
    referralCode: z.string().optional(),
    isHotelGuest: z.boolean(),
    cloudbedsRef: z.string().optional(),
  });

type PersonalData = z.infer<ReturnType<typeof personalSchema>>;

// The single class, or one of the packs on sale. `'dropin'` is the class on
// its own; anything else is a class_packs id.
type PackOption = { id: string; packId: string | null; classes: number; price: number; saving: number };

// Name and hint of each come from the catalogue (booking.step4.methods).
const PAYMENT_METHODS: { id: PaymentMethod; Icon: typeof CreditCard }[] = [
  { id: 'card',  Icon: CreditCard },
  { id: 'venmo', Icon: Smartphone },
  { id: 'cash',  Icon: Banknote },
];

type BookingError = 'no_spots' | 'too_late' | 'code_invalid' | 'already_pending' | 'generic' | null;

async function validateReferralCodeFromDB(
  code: string,
  subtotal: number,
  classPrice: number,
  // How a pack code introduces itself in the applied-code box, in the reader's language.
  packLabels: { name: string; applied: string },
): Promise<{ valid: boolean; code?: ReferralCode; error?: string }> {
  try {
    const res = await fetch('/api/referral-codes/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal }),
    });
    const data = await res.json();
    if (!data.valid) return { valid: false, error: data.error };

    // A class-pack code waives the class fee. Model it as a fixed discount equal
    // to the class price so the existing discount math leaves upsells charged.
    if (data.kind === 'pack') {
      const packCode: ReferralCode = {
        id: code,
        code: code.toUpperCase(),
        partnerName: packLabels.name,
        description: data.description ?? packLabels.applied,
        benefitType: 'fixed',
        discountFixed: classPrice,
        isActive: true,
        usageCount: 0,
        minPurchaseUsd: 0,
        createdAt: new Date(),
      };
      return { valid: true, code: packCode };
    }

    const rc: ReferralCode = {
      id: code,
      code: code.toUpperCase(),
      partnerName: data.partnerName ?? '',
      description: data.description ?? '',
      benefitType: data.benefitType,
      discountPercent: data.discountPercent ?? undefined,
      discountFixed: data.discountFixed ?? undefined,
      freeUpsellId: data.freeUpsellId ?? undefined,
      isActive: true,
      usageCount: 0,
      minPurchaseUsd: 0,
      createdAt: new Date(),
    };
    return { valid: true, code: rc };
  } catch {
    return { valid: false, error: 'invalid' };
  }
}

/** Returns the discount amount in USD given an applied code and subtotal. */
function computeDiscount(code: ReferralCode, subtotal: number, upsells: Upsell[]): number {
  if (code.benefitType === 'percentage') {
    return parseFloat(((subtotal * (code.discountPercent! / 100))).toFixed(2));
  }
  if (code.benefitType === 'fixed') {
    return Math.min(code.discountFixed!, subtotal);
  }
  if (code.benefitType === 'free_upsell') {
    const upsell = upsells.find(u => u.id === code.freeUpsellId);
    return upsell ? Math.min(upsell.priceUsd, subtotal) : 0;
  }
  return 0;
}

// ─── Step headings — booking.steps.step1..4 in the catalogue ──────────────────
const STEP_KEYS = { 1: 'step1', 2: 'step2', 3: 'step3', 4: 'step4' } as const;

// ─── Category derivation (mirrors /yoga's getCategoryKey; kept local for now) ─
// The names compared here are the ones stored in the database, exactly as
// written there ('Pranayama & Meditación' included); they are never
// translated. The category's label comes from the catalogue at render time.
type CategoryKey = 'vinyasa' | 'yin' | 'hatha' | 'ashtanga' | 'meditation' | 'yoga';

function getCategoryKey(name: string): CategoryKey {
  if (['Sunrise Vinyasa', 'Power Flow', 'Breath & Movement', 'Vinyasa Flow', 'Vinyasa Krama', 'Detox Yoga'].includes(name)) return 'vinyasa';
  if (['Yin Yoga', 'Yin & Restore', 'Restorative Yoga', 'Deep Stretch & Breath'].includes(name)) return 'yin';
  if (['Gentle Flow', 'Hatha Foundations'].includes(name)) return 'hatha';
  if (['Ashtanga Primary'].includes(name)) return 'ashtanga';
  if (['Pranayama & Meditación', 'Meditation', 'Tantra Vinyasa'].includes(name)) return 'meditation';
  return 'yoga';
}

// ─── Editorial input style (border-bottom only, no bg, no rounded) ───────────
// Used in Step 3. `!` modifiers override the shadcn Input defaults reliably.
const editorialInput = [
  '!rounded-none !border-0 !border-b !border-ink/30',
  '!bg-transparent !px-0 !py-3 !shadow-none !h-auto',
  'focus-visible:!ring-0 focus-visible:!ring-offset-0',
  'focus-visible:!border-ink',
  '!transition-colors',
].join(' ');

// ─── Demo mode ────────────────────────────────────────────────────────────────
// When NEXT_PUBLIC_BOOKING_DEMO_MODE === 'true', the booking flow does NOT hit
// /api/bookings/create. Instead, it generates a mock reference client-side and
// jumps straight to the confirmation screen. Used for previewing the success
// state in demos when the Supabase backend isn't fully wired up.
//
// Default: off. Set to 'true' in .env.local to enable. Always leave OFF in prod.
// Double-gated on purpose. The env var alone was one stray Vercel setting away
// from a production site that cheerfully confirms bookings which never reach
// the database — and nobody would notice until a guest arrived for a class
// with a reference number nobody has. `NODE_ENV` is set to 'production' by
// `next build`, so this can only ever arm in dev and preview.
const DEMO_MODE =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_BOOKING_DEMO_MODE === 'true';

function mockBookingReference(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HOS-${y}${m}${day}-${code}`;
}

export default function BookingFlow({
  classId, className, instructor, startsAt,
  durationMinutes, capacity, spotsRemaining,
  priceUsd, location, description, color, imageUrl, upsells, packs, locale: bookingLocale,
}: Props) {
  const t = useTranslations('booking');
  const tCategories = useTranslations('yoga.categories');
  const locale = dateFnsLocale(useLocale());
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [selectedUpsellIds, setSelectedUpsellIds] = useState<Set<string>>(new Set());
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [packChoice, setPackChoice] = useState<string>('dropin');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [pendingMethod, setPendingMethod] = useState<'cash' | 'venmo' | null>(null);
  const [venmoModalOpen, setVenmoModalOpen] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [appliedCode, setAppliedCode] = useState<ReferralCode | null>(null);
  const [codeStatus, setCodeStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [codeErrorKey, setCodeErrorKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bookingError, setBookingError] = useState<BookingError>(null);

  // Every date and hour in the flow is Santa Teresa's, whatever the reader's clock says.
  const classDate = inCostaRica(startsAt);
  const isFree = priceUsd === 0;
  const activeUpsells = upsells.filter(u => u.isActive);

  // The options on step 4: this class alone, then each pack the studio sells,
  // with what it saves against booking that many classes one by one.
  const packOptions = useMemo<PackOption[]>(
    () => [
      { id: 'dropin', packId: null, classes: 1, price: priceUsd, saving: 0 },
      ...packs.map((p) => ({
        id: p.id,
        packId: p.id,
        classes: p.classesCount,
        price: p.priceUsd,
        saving: Math.max(0, Math.round((p.classesCount * priceUsd - p.priceUsd) * 100) / 100),
      })),
    ],
    [packs, priceUsd],
  );

  const selectedUpsellsList = useMemo(
    () => activeUpsells.filter(u => selectedUpsellIds.has(u.id)),
    [selectedUpsellIds, activeUpsells],
  );

  const subtotalUpsells = selectedUpsellsList.reduce((acc, u) => acc + u.priceUsd, 0);
  const subtotal = priceUsd + subtotalUpsells;
  const discountAmount = appliedCode ? computeDiscount(appliedCode, subtotal, upsells) : 0;

  // Amount actually charged depends on the selected option: a drop-in charges the
  // class (a code may discount it); a pack charges the pack price (codes don't
  // apply to pack purchases). Upsells are always added.
  const packDef = packOptions.find((p) => p.id === packChoice) ?? packOptions[0];
  const isPack = packDef.packId !== null;
  const basePrice = isPack ? packDef.price : priceUsd;
  const priceLabel = isPack ? t('step4.packOf', { count: packDef.classes }) : t('summary.classLabel');
  const payDiscount = isPack ? 0 : discountAmount;
  const total = Math.max(0, basePrice + subtotalUpsells - payDiscount);
  const isTotalFree = total === 0;

  async function handleApplyCode() {
    const codeStr = form.getValues('referralCode') ?? '';
    if (!codeStr.trim()) return;
    setCodeStatus('loading');
    const result = await validateReferralCodeFromDB(codeStr, subtotal, priceUsd, {
      name: t('step3.packCodeName'),
      applied: t('step3.packCodeApplied'),
    });
    if (result.valid && result.code) {
      setAppliedCode(result.code);
      setCodeStatus('success');
      setCodeErrorKey('');
    } else {
      setAppliedCode(null);
      setCodeStatus('error');
      setCodeErrorKey(result.error ?? 'invalid');
    }
  }

  function codeErrorMsg(key: string): string {
    const keys = {
      invalid: 'invalid',
      not_found: 'invalid',
      inactive: 'inactive',
      expired: 'expired',
      not_started: 'notStarted',
      limit_reached: 'limitReached',
      min_purchase: 'minPurchase',
    } as const;
    const known = (Object.keys(keys) as (keyof typeof keys)[]).find((k) => k === key);
    return t(`step3.codeErrors.${known ? keys[known] : 'generic'}`);
  }

  function toggleUpsell(id: string) {
    setSelectedUpsellIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const schema = useMemo(
    () =>
      personalSchema({
        firstNameRequired: t('step3.errors.firstNameRequired'),
        lastNameRequired: t('step3.errors.lastNameRequired'),
        emailInvalid: t('step3.errors.emailInvalid'),
      }),
    [t],
  );

  const form = useForm<PersonalData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '', lastName: '', email: '',
      phone: '', referralCode: '',
      isHotelGuest: false, cloudbedsRef: '',
    },
  });

  function handlePersonalSubmit(values: PersonalData) {
    setPersonalData(values);
    goToStep(4);
  }

  // Step 4 "confirm" click. Venmo opens the payment modal first; card/cash run
  // the checkout directly.
  function handleStep4() {
    if (paymentMethod === 'venmo' && !DEMO_MODE) {
      setBookingError(null);
      setVenmoModalOpen(true);
      return;
    }
    handleConfirm();
  }

  // Customer tapped "I've paid" in the Venmo modal: only now do we create the
  // (pending) booking. On success the modal unmounts as we move to step 5; on
  // error we close it so the message on step 4 is visible.
  async function handleVenmoPaid() {
    await handleConfirm();
    setVenmoModalOpen(false);
  }

  async function handleConfirm() {
    if (!personalData) return;
    setIsLoading(true);
    setBookingError(null);

    // ── DEMO MODE — bypass the API and jump to the confirmation screen ──────
    if (DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 600)); // short delay for realism
      setPendingMethod(paymentMethod === 'card' ? null : paymentMethod);
      setBookingRef(mockBookingReference());
      goToStep(5);
      setIsLoading(false);
      return;
    }

    try {
      const res = await startBookingCheckout({
        classId,
        upsellIds: Array.from(selectedUpsellIds),
        personalData: {
          firstName: personalData.firstName,
          lastName: personalData.lastName,
          email: personalData.email,
          phone: personalData.phone,
          referralCode: personalData.referralCode,
          isHotelGuest: personalData.isHotelGuest,
          cloudbedsRef: personalData.cloudbedsRef,
        },
        packId: packDef.packId,
        paymentMethod,
        locale: bookingLocale,
      });

      if (!res.ok) {
        setBookingError(errorKind(res.error));
        return;
      }

      if (res.status === 'free') {
        // Fully covered (pack code / discount) — no payment needed.
        setPendingMethod(null);
        setBookingRef(res.bookingReference);
        goToStep(5);
        return;
      }

      if (res.status === 'offline') {
        // Cash/Venmo — spot held, payment collected in person.
        setPendingMethod(res.paymentMethod);
        setBookingRef(res.bookingReference);
        goToStep(5);
        return;
      }

      // Hand off to Tilopay's secure hosted payment page.
      window.location.href = res.url;
    } catch {
      setBookingError('generic');
    } finally {
      setIsLoading(false);
    }
  }

  function handleDownloadICS() {
    downloadICS({
      uid: bookingRef,
      title: className,
      description: t('confirmation.icsDescription', { instructor, ref: bookingRef }),
      location: t('confirmation.icsLocation', { location }),
      startsAt: new Date(startsAt),
      durationMinutes,
      organizerName: 'House of Shakti',
    }, `HOS-${className.toLowerCase().replace(/\s+/g, '-')}`);
  }

  function bookingErrorMsg(): string {
    if (bookingError === 'no_spots') return t('step4.errors.noSpots');
    if (bookingError === 'too_late') return t('step4.errors.tooLate');
    if (bookingError === 'code_invalid') return t('step4.errors.codeInvalid');
    if (bookingError === 'already_pending') return t('step4.errors.alreadyPending');
    return t('step4.errors.generic');
  }

  // ── Step transitions (direction-aware) ─────────────────────────────────────
  function goToStep(target: number) {
    setDirection(target > step ? 'forward' : 'backward');
    setStep(target);
  }
  function handleBack() {
    if (step > 1) goToStep(step - 1);
  }
  function handleContinue() {
    if (step === 1) goToStep(2);
    else if (step === 2) goToStep(3);
    else if (step === 3) form.handleSubmit(handlePersonalSubmit)();
    else if (step === 4) handleStep4();
  }

  // Step 1 is the only step where Continue can be hard-disabled (no spots).
  // Validation on step 3 happens via form.handleSubmit and shows errors inline.
  const canContinue =
    step === 1 ? spotsRemaining > 0 :
    true;

  const stepVariants = useMemo(
    () => (direction === 'forward'
      ? { enter: { opacity: 0, x: 24 }, center: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 } }
      : { enter: { opacity: 0, x: -24 }, center: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 24 } }
    ),
    [direction],
  );

  const isConfirmation = step === 5;
  // A custom image uploaded by the admin overrides the name-based default photo.
  const classImage = imageUrl || getClassPhoto(className);

  // Props bundle for BookingSummary (used in two places: desktop sidebar + mobile drawer).
  // The class image is intentionally NOT included — it lives only in Step 1's main content.
  const summaryProps = {
    className,
    instructor,
    classDate,
    durationMinutes,
    priceUsd: basePrice,
    priceLabel,
    selectedUpsells: selectedUpsellsList,
    appliedCode: isPack ? null : appliedCode,
    discountAmount: payDiscount,
    total,
    isFree: isTotalFree,
  };

  return (
    <div className="min-h-screen bg-warm-white">
      <BookingHeader
        step={step}
        totalSteps={4}
        isConfirmation={isConfirmation}
      />

      {/* Mobile drawer — only on actionable steps */}
      {!isConfirmation && (
        <BookingMobileSummary
          className={className}
          total={total}
          isFree={isTotalFree}
        >
          <BookingSummary {...summaryProps} bare />
        </BookingMobileSummary>
      )}

      {isConfirmation ? (
        <BookingConfirmation
          bookingRef={bookingRef}
          onDownloadICS={handleDownloadICS}
          className={className}
          instructor={instructor}
          classDate={classDate}
          durationMinutes={durationMinutes}
          location={location}
          priceUsd={priceUsd}
          isFree={isFree}
          selectedUpsells={selectedUpsellsList}
          appliedCode={appliedCode}
          discountAmount={discountAmount}
          total={total}
          email={personalData?.email}
          pendingMethod={pendingMethod}
        />
      ) : (
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
          <div className="grid lg:grid-cols-[1fr_38%] gap-12 lg:gap-16">
            {/* ── MAIN COLUMN ── */}
            <div>
              <div className="max-w-2xl">
                {/* Step eyebrow + heading */}
                <motion.div
                  key={`heading-${step}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  <p className="font-body text-[10px] tracking-[0.3em] uppercase text-ink">
                    {t('steps.eyebrow', { step: String(step).padStart(2, '0') })}
                  </p>
                  <h1 className="font-display font-light text-ink text-3xl lg:text-4xl leading-tight mt-2">
                    {t(`steps.${STEP_KEYS[step as 1 | 2 | 3 | 4]}`)}
                  </h1>
                </motion.div>

                {/* Step content */}
                <div className="mt-12 lg:mt-16">
                  <AnimatePresence mode="wait" custom={direction}>
                    {/* ── STEP 1: Class review ── */}
                    {step === 1 && (
                      <motion.div
                        key="step1"
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      >
                        {/* Image */}
                        <motion.div
                          initial={{ opacity: 0, scale: 1.04 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 1.4, ease: 'easeOut' }}
                          className="relative aspect-[16/9] overflow-hidden"
                        >
                          <img
                            src={classImage}
                            alt={className}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </motion.div>

                        {/* Eyebrow row: category + duration */}
                        <div className="flex justify-between items-center mt-8">
                          <span className="font-body text-[10px] tracking-[0.3em] uppercase text-burgundy">
                            {tCategories(getCategoryKey(className))}
                          </span>
                          <span className="font-body text-[10px] tracking-[0.3em] uppercase text-ink">
                            {t('step1.minutes', { count: durationMinutes })}
                          </span>
                        </div>

                        {/* Class title */}
                        <h2 className="font-display font-light text-ink text-3xl lg:text-4xl leading-tight mt-4">
                          {className}
                        </h2>

                        {/* Description (fallback if empty) */}
                        <p className="font-body text-base text-ink leading-relaxed mt-6">
                          {description?.trim() || t('step1.descriptionFallback')}
                        </p>

                        {/* Instructor row */}
                        <div className="mt-12 pt-8 border-t border-ink/10 flex items-center gap-4">
                          <div>
                            <p className="font-body text-[10px] tracking-[0.25em] uppercase text-ink">
                              {t('step1.instructor')}
                            </p>
                            <p className="font-body text-sm text-ink mt-1">{instructor}</p>
                            <p className="font-body text-xs text-ink mt-1">
                              {t('step1.certified')}
                            </p>
                          </div>
                        </div>

                        {/* Schedule micro-grid */}
                        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-6">
                          <ScheduleCell
                            label={t('step1.date')}
                            value={format(classDate, t('step1.dateFormat'), { locale })}
                          />
                          <ScheduleCell
                            label={t('step1.time')}
                            value={`${format(classDate, 'HH:mm')} — ${format(addMinutes(classDate, durationMinutes), 'HH:mm')}`}
                            note={t('step1.timezone')}
                          />
                          <ScheduleCell
                            label={t('step1.availability')}
                            value={
                              spotsRemaining === 0
                                ? t('step1.fullyBooked')
                                : t('step1.spots', { remaining: spotsRemaining, capacity })
                            }
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* ── STEP 2: Extras ── */}
                    {step === 2 && (
                      <motion.div
                        key="step2"
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      >
                        <p className="font-body text-sm text-ink max-w-md">
                          {t('step2.intro')}
                        </p>

                        {activeUpsells.length > 0 ? (
                          <div className="mt-12 space-y-4">
                            {activeUpsells.map((u) => {
                              const checked = selectedUpsellIds.has(u.id);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => toggleUpsell(u.id)}
                                  className={`
                                    group w-full text-left
                                    flex justify-between items-start gap-6 p-6
                                    border transition-all duration-300 ease-out cursor-pointer
                                    ${checked
                                      ? 'border-ink bg-cream/60'
                                      : 'border-ink/10 hover:border-ink/30 hover:bg-cream/30'}
                                  `}
                                  aria-pressed={checked}
                                >
                                  {/* LEFT */}
                                  <div className="flex-1 min-w-0">
                                    {u.priceUsd === 0 && (
                                      <span className="inline-block font-body text-[10px] tracking-[0.2em] uppercase text-burgundy border border-burgundy/30 px-2 py-[2px]">
                                        {t('step2.included')}
                                      </span>
                                    )}
                                    <h3 className={`font-display font-light text-ink text-lg lg:text-xl leading-tight ${u.priceUsd === 0 ? 'mt-3' : ''}`}>
                                      {u.name}
                                    </h3>
                                    {u.description && (
                                      <p className="font-body text-sm text-ink leading-relaxed mt-2">
                                        {u.description}
                                      </p>
                                    )}
                                  </div>

                                  {/* RIGHT: price + checkbox indicator */}
                                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                                    <span className="font-display font-light text-ink text-xl lg:text-2xl">
                                      {u.priceUsd === 0 ? '—' : `+$${u.priceUsd}`}
                                    </span>
                                    <span
                                      aria-hidden
                                      className={`
                                        w-5 h-5 inline-flex items-center justify-center
                                        border transition-colors duration-300
                                        ${checked ? 'border-ink bg-ink' : 'border-ink/30'}
                                      `}
                                    >
                                      {checked && <Check className="w-3 h-3 text-cream" strokeWidth={2} />}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="font-body text-sm text-ink italic mt-12">
                            {t('step2.none')}
                          </p>
                        )}
                      </motion.div>
                    )}

                    {/* ── STEP 3: Your details ── */}
                    {step === 3 && (
                      <motion.div
                        key="step3"
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      >
                        <p className="font-body text-sm text-ink max-w-md">
                          {t('step3.intro')}
                        </p>

                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(handlePersonalSubmit)} className="space-y-8 mt-12">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                              <FormField control={form.control} name="firstName" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="font-body text-[10px] tracking-[0.25em] uppercase text-ink">{t('step3.firstName')}</FormLabel>
                                  <FormControl><Input placeholder={t('step3.placeholders.firstName')} className={editorialInput} {...field} /></FormControl>
                                  <FormMessage className="text-xs text-burgundy mt-1" />
                                </FormItem>
                              )} />
                              <FormField control={form.control} name="lastName" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="font-body text-[10px] tracking-[0.25em] uppercase text-ink">{t('step3.lastName')}</FormLabel>
                                  <FormControl><Input placeholder={t('step3.placeholders.lastName')} className={editorialInput} {...field} /></FormControl>
                                  <FormMessage className="text-xs text-burgundy mt-1" />
                                </FormItem>
                              )} />
                            </div>

                            <FormField control={form.control} name="email" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-body text-[10px] tracking-[0.25em] uppercase text-ink">{t('step3.email')}</FormLabel>
                                <FormControl><Input type="email" placeholder={t('step3.placeholders.email')} className={editorialInput} {...field} /></FormControl>
                                <FormMessage className="text-xs text-burgundy mt-1" />
                              </FormItem>
                            )} />

                            <FormField control={form.control} name="phone" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-body text-[10px] tracking-[0.25em] uppercase text-ink">
                                  {t('step3.phone')} <span className="font-normal normal-case tracking-normal">{t('step3.optional')}</span>
                                </FormLabel>
                                <FormControl><Input placeholder={t('step3.placeholders.phone')} className={editorialInput} {...field} /></FormControl>
                                <FormMessage className="text-xs text-burgundy mt-1" />
                              </FormItem>
                            )} />

                            {/* Referral code */}
                            <FormField control={form.control} name="referralCode" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1.5 font-body text-[10px] tracking-[0.25em] uppercase text-ink">
                                  <Tag className="w-3 h-3 text-ink" strokeWidth={1.5} />
                                  {t('step3.code')} <span className="font-normal normal-case tracking-normal">{t('step3.optional')}</span>
                                </FormLabel>
                                <div className="flex items-end gap-3">
                                  <FormControl>
                                    <Input
                                      placeholder={t('step3.codePlaceholder')}
                                      {...field}
                                      onChange={(e) => {
                                        field.onChange(e);
                                        setCodeStatus('idle');
                                        setAppliedCode(null);
                                      }}
                                      className={`${editorialInput} uppercase tracking-[0.15em]`}
                                    />
                                  </FormControl>
                                  <button
                                    type="button"
                                    onClick={handleApplyCode}
                                    disabled={!field.value?.trim() || codeStatus === 'loading'}
                                    className="flex-shrink-0 font-body text-xs tracking-[0.25em] uppercase text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer pb-3"
                                  >
                                    {codeStatus === 'loading'
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                                      : t('step3.apply')}
                                  </button>
                                </div>
                                <FormMessage className="text-xs text-burgundy mt-1" />
                                {codeStatus === 'success' && appliedCode && (
                                  <div className="flex items-start gap-2 mt-3 py-3 border-l-2 border-burgundy pl-3">
                                    <CheckCircle className="w-4 h-4 text-burgundy flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                    <div>
                                      <p className="font-body text-xs font-medium text-ink">
                                        {appliedCode.partnerName} — {
                                          appliedCode.benefitType === 'percentage'
                                            ? t('step3.discountPercent', { percent: appliedCode.discountPercent ?? 0 })
                                            : appliedCode.benefitType === 'fixed'
                                              ? t('step3.discountFixed', { amount: appliedCode.discountFixed ?? 0 })
                                              : t('step3.freeGift')
                                        }
                                      </p>
                                      <p className="font-body text-[11px] text-ink mt-0.5">{appliedCode.description}</p>
                                    </div>
                                  </div>
                                )}
                                {codeStatus === 'error' && (
                                  <div className="flex items-center gap-2 mt-3 py-2 border-l-2 border-burgundy pl-3">
                                    <XCircle className="w-4 h-4 text-burgundy flex-shrink-0" strokeWidth={1.5} />
                                    <p className="font-body text-xs text-burgundy">{codeErrorMsg(codeErrorKey)}</p>
                                  </div>
                                )}
                              </FormItem>
                            )} />

                          </form>
                        </Form>
                      </motion.div>
                    )}

                    {/* ── STEP 4: Payment / Confirm ── */}
                    {step === 4 && personalData && (
                      <motion.div
                        key="step4"
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      >
                        <p className="font-body text-sm text-ink max-w-md">
                          {t('step4.intro')}
                        </p>

                        {/* Pack type selector — editorial flat cards, no radius */}
                        <div className="mt-12 border-y border-ink/10 divide-y divide-ink/10">
                          {packOptions.map((pack) => {
                            const active = packChoice === pack.id;
                            const displayPrice = pack.price;
                            return (
                              <button
                                key={pack.id}
                                type="button"
                                onClick={() => setPackChoice(pack.id)}
                                className={`
                                  group relative w-full flex items-center justify-between
                                  py-5 pl-8 pr-2 text-left
                                  cursor-pointer transition-colors duration-300
                                  ${active ? '' : 'hover:bg-ink/[0.02]'}
                                `}
                              >
                                {/* Burgundy active marker on the left */}
                                <span
                                  aria-hidden
                                  className={`
                                    absolute left-0 top-1/2 -translate-y-1/2 h-10 w-[2px]
                                    transition-opacity duration-300
                                    ${active ? 'bg-burgundy opacity-100' : 'opacity-0'}
                                  `}
                                />
                                <div className="flex items-center gap-4">
                                  <div className={`
                                    w-4 h-4 rounded-full border flex-shrink-0
                                    flex items-center justify-center transition-colors duration-300
                                    ${active ? 'border-ink' : 'border-ink/40'}
                                  `}>
                                    {active && <div className="w-1.5 h-1.5 rounded-full bg-ink" />}
                                  </div>
                                  <div>
                                    <p className="font-body text-sm font-medium text-ink">
                                      {pack.packId ? t('step4.packOf', { count: pack.classes }) : t('step4.packs.dropin')}
                                    </p>
                                    {pack.saving > 0 && (
                                      <p className="font-body text-xs text-burgundy mt-1">
                                        {t('step4.savings', { amount: pack.saving })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className="font-body text-sm text-ink">{t('step4.priceUsd', { amount: displayPrice })}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Payment method selector */}
                        <div className="mt-10">
                          <p className="font-body text-[10px] tracking-[0.25em] uppercase text-ink">
                            {t('step4.paymentMethod')}
                          </p>
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {PAYMENT_METHODS.map(({ id, Icon }) => {
                              const active = paymentMethod === id;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setPaymentMethod(id)}
                                  aria-pressed={active}
                                  className={`
                                    group flex flex-col items-start gap-2 p-4 text-left
                                    border transition-all duration-300 ease-out cursor-pointer
                                    ${active
                                      ? 'border-ink bg-cream/60'
                                      : 'border-ink/10 hover:border-ink/30 hover:bg-cream/30'}
                                  `}
                                >
                                  <Icon className="w-5 h-5 text-ink" strokeWidth={1.5} />
                                  <span className="font-body text-sm font-medium text-ink">{t(`step4.methods.${id}.name`)}</span>
                                  <span className="font-body text-xs text-ink/60 leading-snug">{t(`step4.methods.${id}.hint`)}</span>
                                </button>
                              );
                            })}
                          </div>
                          {paymentMethod === 'venmo' && (
                            <p className="font-body text-xs text-ink/70 mt-4 leading-relaxed">
                              {t('step4.venmoNote')}
                            </p>
                          )}
                          {paymentMethod === 'cash' && (
                            <p className="font-body text-xs text-ink/70 mt-4 leading-relaxed">
                              {t('step4.cashNote')}
                            </p>
                          )}
                        </div>

                        {/* Cancellation note */}
                        <p className="font-body text-xs text-ink mt-6">
                          {t('step4.cancellation')}
                        </p>

                        {/* Error message */}
                        {bookingError && (
                          <div className="mt-4 flex items-start gap-2 py-3 border-l-2 border-burgundy pl-3">
                            <XCircle className="w-4 h-4 text-burgundy flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                            <p className="font-body text-xs text-burgundy">{bookingErrorMsg()}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <BookingNavigation
                  step={step}
                  isLoading={isLoading}
                  canContinue={canContinue}
                  onBack={handleBack}
                  onContinue={handleContinue}
                  payLabel={t(`step4.pay.${paymentMethod}`)}
                />
              </div>
            </div>

            {/* ── DESKTOP SIDEBAR ── */}
            <aside className="hidden lg:block">
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="sticky top-24"
              >
                <BookingSummary {...summaryProps} />
              </motion.div>
            </aside>
          </div>
        </div>
      )}

      <VenmoModal
        open={venmoModalOpen}
        amount={total}
        note={personalData ? `${personalData.firstName} ${personalData.lastName}` : ''}
        isLoading={isLoading}
        onPaid={handleVenmoPaid}
        onCancel={() => setVenmoModalOpen(false)}
      />
    </div>
  );
}

// What the checkout said went wrong, as the message the reader gets.
function errorKind(error: CheckoutError): BookingError {
  if (error === 'no_spots_available') return 'no_spots';
  if (error === 'booking_too_late') return 'too_late';
  if (error === 'code_invalid') return 'code_invalid';
  if (error === 'already_pending') return 'already_pending';
  return 'generic';
}

// ── Schedule micro-grid cell used in Step 1 (label on top, value below) ─────
function ScheduleCell({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="font-body text-[10px] tracking-[0.25em] uppercase text-ink">{label}</p>
      <p className="font-body text-sm text-ink mt-1">{value}</p>
      {note && <p className="font-body text-[11px] text-ink/60 mt-0.5">{note}</p>}
    </div>
  );
}
