'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import { MessageCircle, Mail, Phone, ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Navigation } from '@/components/landing/navigation';
import { Footer } from '@/components/landing/footer';
import { BUSINESS } from '@/lib/business';

// /contact — information-only contact page modeled on aman.com/contact-us.
// No form, no newsletter, no social links (those live in the footer).
// Layout: centered page heading → asymmetric 30/70 two-column (info blocks
// + vertical image) → two full-width sections (Visit, Press & Media)
// separated by hairline borders.

// ─── Contact data ───────────────────────────────────────────────────────────
// Every value on this page comes from lib/business.ts, which is also what the
// footer, the calendar invitations and the JSON-LD read. One mailbox per
// block, so the page doubles as the map of who answers what: stays and
// general questions, the shala, retreats, the teacher training, the press.
const EMAIL_RESERVATIONS = BUSINESS.email.general;
const EMAIL_STUDIO = BUSINESS.email.yogaStudio;
const EMAIL_RETREATS = BUSINESS.email.retreats;
const EMAIL_TRAINING = BUSINESS.email.founder;
const EMAIL_MEDIA = BUSINESS.email.media;

const PHONE_E164 = BUSINESS.phone;
const PHONE_DISPLAY = BUSINESS.phoneDisplay;
const WHATSAPP_URL = BUSINESS.whatsappUrl;
// The Google Business profile itself, not a search query.
const MAPS_URL = BUSINESS.googleMapsUrl;

// TODO: replace with curated pool + jungle vertical composition when available.
// Placeholder is the most vertical-leaning sanctuary frame not yet used in
// other parts of the site.
const COLUMN_IMAGE = '/images/sanctuary/271A0723_websize%201.webp';

// ─── Small primitives ───────────────────────────────────────────────────────

/** Email / WhatsApp / Phone link — shared anchor styling across the page. */
function ContactLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const externalProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' as const }
    : {};
  return (
    <a
      href={href}
      {...externalProps}
      className="font-body text-base text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300 cursor-pointer"
    >
      {children}
    </a>
  );
}

/** Label : Value row used inside left-column info blocks. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-body text-base text-ink">{label}</span>
      {children}
    </div>
  );
}

/**
 * Primary CTA — a bordered "chip" contact action with an icon.
 * Used for the most important reach-outs (WhatsApp, Email). Bigger tap target,
 * clearer affordance than a bare underlined link, while staying editorial.
 */
function ContactCTA({
  href,
  icon: Icon,
  label,
  value,
  external = false,
  emphasis = false,
}: {
  href: string;
  icon: typeof MessageCircle;
  label: string;
  value: string;
  external?: boolean;
  emphasis?: boolean;
}) {
  const externalProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' as const }
    : {};
  return (
    <a
      href={href}
      {...externalProps}
      className={`group flex items-center gap-4 px-5 py-4 border transition-colors duration-300 cursor-pointer ${
        emphasis
          ? 'border-burgundy/40 bg-burgundy/[0.04] hover:bg-burgundy/[0.08]'
          : 'border-ink/15 hover:border-ink/40 hover:bg-ink/[0.02]'
      }`}
    >
      <Icon
        className={`w-5 h-5 flex-shrink-0 ${emphasis ? 'text-burgundy' : 'text-ink'}`}
        strokeWidth={1.5}
      />
      <span className="flex flex-col min-w-0">
        <span className="font-body text-[10px] tracking-[0.2em] uppercase text-ink/50">
          {label}
        </span>
        <span className="font-body text-base text-ink truncate">{value}</span>
      </span>
      <ArrowUpRight
        className="w-4 h-4 ml-auto flex-shrink-0 text-ink/40 group-hover:text-ink group-hover:translate-x-[1px] group-hover:-translate-y-[1px] transition-all duration-300"
        strokeWidth={1.5}
      />
    </a>
  );
}

/**
 * A heading, a sentence on who it is for, and one mailbox. Blocks two to four
 * of the left column are exactly this; the first also carries WhatsApp and
 * the phone, so it stays written out.
 */
function MailBlock({
  heading,
  body,
  email,
  emailLabel,
  delay,
  inView,
}: {
  heading: string;
  body: string;
  email: string;
  emailLabel: string;
  delay: number;
  inView: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 1.0, ease: 'easeOut', delay }}
      className="border-t border-ink/10 py-10 lg:py-12"
    >
      <h2 className="font-display font-light text-ink text-xl lg:text-2xl leading-snug">
        {heading}
      </h2>
      <p className="font-body text-base text-ink leading-relaxed mt-5 max-w-xl">{body}</p>
      <div className="mt-7 max-w-xl">
        <ContactCTA href={`mailto:${email}`} icon={Mail} label={emailLabel} value={email} />
      </div>
    </motion.div>
  );
}

// ─── Sections ───────────────────────────────────────────────────────────────

// 1) Page heading — centered, generous breathing room. Mount-animated
//    (not scroll-triggered) since it sits at the top of the page.
function PageHeading() {
  const t = useTranslations('contact');
  return (
    <section className="bg-warm-white pt-24 lg:pt-32 pb-10 lg:pb-12">
      <div className="w-[90%] md:w-[80%] mx-auto text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
          className="font-display font-light text-ink text-4xl md:text-5xl lg:text-6xl leading-[1.1]"
        >
          {t('heading')}
        </motion.h1>
      </div>
    </section>
  );
}

// 2) Two-column section — asymmetric 30/70. Left: stacked info blocks
//    separated by hairline borders. Right: large vertical image.
function ContactColumns() {
  const t = useTranslations('contact');
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section className="bg-warm-white pb-16 lg:pb-20">
      <div
        ref={sectionRef}
        className="w-[90%] md:w-[80%] mx-auto grid grid-cols-1 lg:grid-cols-10 gap-8 lg:gap-16 items-start"
      >
        {/* LEFT — info blocks (col-span-6 = 60%, roomier + more legible) */}
        <div className="lg:col-span-6 order-2 lg:order-1">
          {/* Block 1 — Reservations & Inquiries */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.0 }}
            className="border-t border-ink/10 py-10 lg:py-12"
          >
            <h2 className="font-display font-light text-ink text-xl lg:text-2xl leading-snug">
              {t('reservations.heading')}
            </h2>
            <p className="font-body text-base text-ink leading-relaxed mt-5 max-w-xl">
              {t('reservations.body')}
            </p>
            {/* Primary reach-outs — WhatsApp first (fastest), then email + phone.
                Email spans full width so the address never truncates. */}
            <div className="grid sm:grid-cols-2 gap-3 mt-7 max-w-xl">
              <ContactCTA
                href={WHATSAPP_URL}
                icon={MessageCircle}
                label={t('reservations.whatsapp')}
                value={PHONE_DISPLAY}
                external
                emphasis
              />
              <ContactCTA
                href={`tel:${PHONE_E164}`}
                icon={Phone}
                label={t('reservations.call')}
                value={PHONE_DISPLAY}
              />
              <div className="sm:col-span-2">
                <ContactCTA
                  href={`mailto:${EMAIL_RESERVATIONS}`}
                  icon={Mail}
                  label={t('reservations.email')}
                  value={EMAIL_RESERVATIONS}
                />
              </div>
            </div>
          </motion.div>

          {/* Blocks 2–4 — one mailbox each: the shala, retreats, the training. */}
          <MailBlock
            heading={t('yogaStudio.heading')}
            body={t('yogaStudio.body')}
            email={EMAIL_STUDIO}
            emailLabel={t('reservations.email')}
            delay={0.1}
            inView={inView}
          />
          <MailBlock
            heading={t('host.heading')}
            body={t('host.body')}
            email={EMAIL_RETREATS}
            emailLabel={t('reservations.email')}
            delay={0.2}
            inView={inView}
          />
          <MailBlock
            heading={t('training.heading')}
            body={t('training.body')}
            email={EMAIL_TRAINING}
            emailLabel={t('reservations.email')}
            delay={0.3}
            inView={inView}
          />
        </div>

        {/* RIGHT — vertical image (col-span-4 = 40%, smaller than before) */}
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.04 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
          className="lg:col-span-4 order-1 lg:order-2 lg:sticky lg:top-28"
        >
          <div className="relative aspect-[4/5] overflow-hidden bg-ink/5 max-w-sm lg:max-w-none mx-auto">
            <Image
              src={COLUMN_IMAGE}
              alt={t('imageAlt')}
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
              priority
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// 3) Visit — full-width single-column. Hairline frame top + bottom.
function VisitSection() {
  const t = useTranslations('contact.visit');
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="bg-warm-white py-8 lg:py-10">
      <div ref={ref} className="w-[90%] md:w-[80%] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
          className="border-t border-ink/10 py-10 lg:py-12"
        >
          <h2 className="font-display font-light text-ink text-xl lg:text-2xl leading-snug">
            {t('heading')}
          </h2>
          <p className="font-body text-base text-ink leading-relaxed max-w-2xl mt-6">
            {t('body')}
          </p>

          {/* Address block — the same three lines the footer shows, from the
              one record in lib/business.ts. The street address itself is still
              a TODO_CONFIRM there. */}
          <address className="not-italic space-y-1 mt-6">
            {BUSINESS.addressLines.map((line) => (
              <p key={line} className="font-body text-base text-ink">
                {line}
              </p>
            ))}
          </address>

          <div className="mt-6">
            <ContactLink href={MAPS_URL} external>
              {t('maps')}
            </ContactLink>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// 4) Press & Media — full-width single-column. Hairline frame top + bottom.
//    The top border doubles as the visual separator from the Visit section
//    (single line between them, not two).
function PressSection() {
  const t = useTranslations('contact.press');
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="bg-warm-white pb-12 lg:pb-16">
      <div ref={ref} className="w-[90%] md:w-[80%] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
          className="border-t border-b border-ink/10 py-10 lg:py-12"
        >
          <h2 className="font-display font-light text-ink text-xl lg:text-2xl leading-snug">
            {t('heading')}
          </h2>
          <p className="font-body text-base text-ink leading-relaxed max-w-2xl mt-6">
            {t('body')}
          </p>
          <div className="mt-6">
            <DetailRow label={t('emailLabel')}>
              <ContactLink href={`mailto:${EMAIL_MEDIA}`}>
                {EMAIL_MEDIA}
              </ContactLink>
            </DetailRow>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ContactPageClient() {
  return (
    <main id="main-content" className="bg-warm-white overflow-hidden">
      <Navigation />
      <PageHeading />
      <ContactColumns />
      <VisitSection />
      <PressSection />
      <Footer />
    </main>
  );
}
