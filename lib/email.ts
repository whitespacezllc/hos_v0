import { Resend } from 'resend';
import { createTranslator } from 'next-intl';
import { format } from 'date-fns';
import { BUSINESS } from '@/lib/business';
import { routing, type AppLocale } from '@/i18n/routing';
import { dateFnsLocale } from '@/lib/dates';
import { inCostaRica } from '@/lib/costa-rica-time';
import { generateICS } from '@/lib/ics';
import { VENMO_HANDLE } from '@/lib/payment-methods';
import { localizedPath } from '@/lib/seo';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

// ─── Transactional email ─────────────────────────────────────────────────────
// Every email the money path sends: a class booked (confirmed, held for cash /
// Venmo, paid later, cancelled) and a class pack's personal code. All of them
// share one shell, speak the customer's language, show Costa Rica time, and
// reply to the studio's mailbox.
//
// The catalogues are statically imported: this runs in server actions and
// route handlers, outside any request next-intl could configure, so each
// translator is built by hand from the `email` namespace.
const MESSAGES: Record<AppLocale, { email: typeof en.email }> = { en, es };

function translator(locale: AppLocale, namespace: 'email.common' | 'email.booking' | 'email.packCode') {
  return createTranslator({ locale, messages: MESSAGES[locale], namespace });
}

// Email is optional infrastructure: without RESEND_API_KEY, sends are skipped
// (never thrown) so the booking itself always goes through. The admin can
// resend a pack code once the key is configured.
const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? 'House of Shakti <onboarding@resend.dev>';
const resend = apiKey ? new Resend(apiKey) : null;

if (apiKey && !process.env.EMAIL_FROM && process.env.NODE_ENV === 'production') {
  // Resend's onboarding sender only delivers to the account's own address.
  console.warn('[email] EMAIL_FROM is not set — customers will not receive email until a verified sender is configured');
}

export type SendResult = { sent: boolean; skipped?: boolean; error?: string };

type Deliverable = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
  /** Short label for the logs — never an address or a code. */
  tag: string;
  /** Where a reply lands. The general mailbox unless the sender names another. */
  replyTo?: string;
};

async function deliver(mail: Deliverable): Promise<SendResult> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping ${mail.tag}`);
    return { sent: false, skipped: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: mail.to,
      replyTo: mail.replyTo ?? BUSINESS.email.general,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
    });
    if (error) {
      console.error(`[email] ${mail.tag} send failed:`, error);
      return { sent: false, error: error.message ?? String(error) };
    }
    console.log(`[email] ${mail.tag} sent`, data?.id ?? '');
    return { sent: true };
  } catch (err) {
    console.error(`[email] ${mail.tag} send threw:`, err);
    return { sent: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

// ─── Shared pieces ───────────────────────────────────────────────────────────
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const strong = (chunks: string) => `<strong>${chunks}</strong>`;

/** `$20` or `$20.50`, in USD. */
export function formatUsd(amount: number): string {
  const n = Number(amount);
  return Number.isInteger(n) ? `$${n} USD` : `$${n.toFixed(2)} USD`;
}

/**
 * "Friday, September 11, 2026" / "viernes 11 de septiembre de 2026", in Santa
 * Teresa. Capitalised for a labelled row; as-is inside a sentence, where a
 * Spanish weekday stays lowercase.
 */
export function formatEmailDate(startsAt: string | Date, locale: AppLocale, inSentence = false): string {
  const pattern = locale === 'es' ? "EEEE d 'de' MMMM 'de' yyyy" : 'EEEE, MMMM d, yyyy';
  const s = format(inCostaRica(startsAt), pattern, { locale: dateFnsLocale(locale) });
  return inSentence ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Fri, Sep 11" / "vie 11 sep" — for subject lines. */
function formatShortDate(startsAt: string | Date, locale: AppLocale): string {
  const pattern = locale === 'es' ? 'EEE d MMM' : 'EEE, MMM d';
  return format(inCostaRica(startsAt), pattern, { locale: dateFnsLocale(locale) });
}

/** "07:00 – 08:30", in Santa Teresa. */
export function formatEmailTime(startsAt: string | Date, durationMinutes: number): string {
  const start = inCostaRica(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${format(start, 'HH:mm')} – ${format(inCostaRica(end), 'HH:mm')}`;
}

const FONT = "font-family:Arial,Helvetica,sans-serif;";
const SERIF = "font-family:Georgia,'Times New Roman',serif;";
const INK = '#313131';
const MUTED = 'rgba(49,49,49,0.6)';
const HAIRLINE = '1px solid rgba(49,49,49,0.12)';

type ShellParams = {
  locale: AppLocale;
  title: string;
  preheader: string;
  heading: string;
  body: string;
};

// One table-based shell for every email: it survives Gmail, Outlook and Apple
// Mail, stays under 600px, and reads on a phone. Colours are the site's —
// warm white ground, ink text, burgundy for the one action.
function shell({ locale, title, preheader, heading, body }: ShellParams): string {
  const c = translator(locale, 'email.common');
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f4ef;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f4ef;">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:${HAIRLINE};">
  <tr><td style="padding:36px 32px 0;${FONT}">
    <p style="margin:0;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:${MUTED};">${escapeHtml(c('brand'))}</p>
    <h1 style="margin:12px 0 0;${SERIF}font-weight:normal;font-size:26px;line-height:1.25;color:${INK};">${escapeHtml(heading)}</h1>
  </td></tr>
  <tr><td style="padding:24px 32px 36px;${FONT}font-size:15px;line-height:1.65;color:${INK};">
    ${body}
  </td></tr>
  <tr><td style="padding:20px 32px;border-top:${HAIRLINE};${FONT}font-size:11px;line-height:1.6;color:${MUTED};">
    <p style="margin:0;">${escapeHtml(c('footer'))}</p>
    <p style="margin:4px 0 0;"><a href="${BUSINESS.url}" style="color:${MUTED};text-decoration:underline;">${BUSINESS.url.replace(/^https?:\/\//, '')}</a> · <a href="${BUSINESS.whatsappUrl}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(c('whatsapp', { phone: BUSINESS.phoneDisplay }))}</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function paragraph(html: string, opts: { muted?: boolean; size?: number } = {}): string {
  const color = opts.muted ? MUTED : INK;
  const size = opts.size ?? 15;
  return `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.65;color:${color};">${html}</p>`;
}

function button(label: string, href: string): string {
  return `<p style="margin:24px 0 8px;"><a href="${href}" style="display:inline-block;background:#8D0000;color:#f7f4ef;text-decoration:none;${FONT}font-size:13px;letter-spacing:0.12em;text-transform:uppercase;padding:14px 26px;">${escapeHtml(label)}</a></p>`;
}

function bigCode(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px;"><tr><td align="center">
    <span style="display:inline-block;font-family:'Courier New',Courier,monospace;font-size:24px;letter-spacing:0.18em;padding:16px 28px;background:#f7f4ef;border:1px dashed #8D0000;color:${INK};">${escapeHtml(code)}</span>
  </td></tr></table>`;
}

type Row = { label: string; value: string; strong?: boolean; tone?: 'burgundy' };

function detailTable(rows: Row[]): string {
  const cells = rows
    .map(
      (r) => `<tr>
      <td style="padding:10px 0;border-top:${HAIRLINE};${FONT}font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:${MUTED};vertical-align:top;width:38%;">${escapeHtml(r.label)}</td>
      <td style="padding:10px 0;border-top:${HAIRLINE};${FONT}font-size:14px;line-height:1.5;color:${r.tone === 'burgundy' ? '#8D0000' : INK};${r.strong ? 'font-weight:bold;' : ''}vertical-align:top;">${r.value}</td>
    </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px;border-bottom:${HAIRLINE};">${cells}</table>`;
}

function referenceBlock(label: string, reference: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td align="center" style="padding:20px;background:#f7f4ef;">
    <p style="margin:0;${FONT}font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</p>
    <p style="margin:8px 0 0;${SERIF}font-size:24px;letter-spacing:0.08em;color:${INK};">${escapeHtml(reference)}</p>
  </td></tr></table>`;
}

function closing(locale: AppLocale): string {
  const c = translator(locale, 'email.common');
  return (
    paragraph(escapeHtml(c('questions')), { muted: true, size: 13 }) +
    paragraph(`${escapeHtml(c('signoff'))}<br>${escapeHtml(c('team'))}`)
  );
}

// ─── Class booking ───────────────────────────────────────────────────────────
/**
 *   confirmed — paid now (card approved, or nothing to pay)
 *   paid      — a held cash / Venmo booking the admin marked as collected
 *   pending   — held for cash / Venmo, payment still to come
 *   cancelled — released, by the admin
 */
export type BookingEvent = 'confirmed' | 'paid' | 'pending' | 'cancelled';

export type BookingEmailData = {
  event: BookingEvent;
  to: string;
  firstName: string;
  reference: string;
  className: string;
  instructor: string | null;
  /** ISO instant. */
  startsAt: string;
  durationMinutes: number;
  location: string;
  classPriceUsd: number;
  extras: { name: string; priceUsd: number }[];
  totalUsd: number;
  paymentMethod: 'card' | 'cash' | 'venmo';
  /**
   *   none          — the class was paid at its price (a referral code may have discounted it)
   *   pack_code     — a paid pack's code waived the class fee
   *   pack_purchase — a pack bought together with this booking covers it
   */
  coveredBy: 'none' | 'pack_code' | 'pack_purchase';
  /** The referral or pack code the customer typed, if any. */
  code: string | null;
  packName: string | null;
  /** cancelled only: a pack credit was given back. */
  creditReturned?: boolean;
  locale: AppLocale;
};

export function bookingEmailSubject(d: BookingEmailData): string {
  const t = translator(d.locale, 'email.booking');
  return t(`subject.${d.event}`, { className: d.className, date: formatShortDate(d.startsAt, d.locale) });
}

export function bookingEmailHtml(d: BookingEmailData): string {
  const t = translator(d.locale, 'email.booking');
  const c = translator(d.locale, 'email.common');
  const date = formatEmailDate(d.startsAt, d.locale);
  const time = formatEmailTime(d.startsAt, d.durationMinutes);
  const className = escapeHtml(d.className);
  const isPending = d.event === 'pending';
  const isCancelled = d.event === 'cancelled';

  const parts: string[] = [];
  parts.push(paragraph(escapeHtml(t('hello', { firstName: d.firstName }))));

  if (isCancelled) {
    parts.push(
      paragraph(t.markup('intro.cancelled', { reference: escapeHtml(d.reference), className, date: formatEmailDate(d.startsAt, d.locale, true), time, strong })),
    );
    if (d.creditReturned) parts.push(paragraph(escapeHtml(t('creditReturned'))));
    parts.push(paragraph(escapeHtml(t('cancelledPayment')), { muted: true, size: 13 }));
    parts.push(button(t('schedule'), `${BUSINESS.url}${localizedPath('/yoga', d.locale)}`));
    parts.push(closing(d.locale));
    return shell({
      locale: d.locale,
      title: bookingEmailSubject(d),
      preheader: t('preheader.cancelled', { reference: d.reference }),
      heading: t('heading.cancelled'),
      body: parts.join(''),
    });
  }

  parts.push(paragraph(t.markup(`intro.${d.event}`, { className, strong })));
  if (d.coveredBy === 'pack_purchase' && d.packName) {
    parts.push(paragraph(t.markup(isPending ? 'pack.pending' : 'pack.confirmed', { packName: escapeHtml(d.packName), strong })));
  } else if (d.coveredBy === 'pack_code' && d.code) {
    parts.push(paragraph(t.markup('pack.code', { code: escapeHtml(d.code), strong })));
  }

  parts.push(referenceBlock(t('labels.reference'), d.reference));

  const rows: Row[] = [
    { label: t('labels.class'), value: className, strong: true },
  ];
  if (d.instructor) rows.push({ label: t('labels.instructor'), value: escapeHtml(d.instructor) });
  rows.push(
    { label: t('labels.date'), value: escapeHtml(date) },
    { label: t('labels.time'), value: escapeHtml(time) },
    { label: t('labels.duration'), value: escapeHtml(t('minutes', { count: d.durationMinutes })) },
    { label: t('labels.location'), value: escapeHtml(d.location) },
  );
  if (d.extras.length > 0) {
    rows.push({
      label: t('labels.extras'),
      value: d.extras
        .map((u) => `${escapeHtml(u.name)} · ${u.priceUsd === 0 ? escapeHtml(t('included')) : formatUsd(u.priceUsd)}`)
        .join('<br>'),
    });
  }

  // How it was, or will be, paid.
  const total = Number(d.totalUsd);
  let paymentLine: string;
  if (isPending) {
    paymentLine = escapeHtml(t(`paymentMethod.${d.paymentMethod === 'venmo' ? 'venmo' : 'cash'}`));
  } else if (total === 0) {
    paymentLine = escapeHtml(t(d.coveredBy === 'none' ? 'paymentMethod.free' : 'paymentMethod.pack'));
  } else if (d.paymentMethod === 'card') {
    paymentLine = escapeHtml(t('paymentMethod.card'));
  } else {
    paymentLine = escapeHtml(t(`paymentMethod.${d.paymentMethod}`));
  }
  const discount = Math.max(0, Number(d.classPriceUsd) + d.extras.reduce((a, u) => a + Number(u.priceUsd), 0) - total);
  if (d.coveredBy === 'none' && d.code && discount > 0) {
    paymentLine += `<br><span style="color:#8D0000;">${escapeHtml(t('discount', { code: d.code }))} · −${formatUsd(discount)}</span>`;
  }
  rows.push({ label: t('labels.payment'), value: paymentLine });
  rows.push({
    label: t(isPending ? 'labels.amountDue' : 'labels.total'),
    value: total === 0 ? escapeHtml(t('free')) : formatUsd(total),
    strong: true,
  });
  parts.push(detailTable(rows));
  parts.push(paragraph(escapeHtml(c('timezone')), { muted: true, size: 12 }));

  if (isPending) {
    parts.push(
      paragraph(
        d.paymentMethod === 'venmo'
          ? t.markup('instructions.venmo', { amount: formatUsd(total), handle: escapeHtml(VENMO_HANDLE), reference: escapeHtml(d.reference), strong })
          : t.markup('instructions.cash', { amount: formatUsd(total), strong }),
      ),
    );
  }

  parts.push(paragraph(escapeHtml(t('arrive'))));
  parts.push(paragraph(escapeHtml(t('calendar')), { muted: true, size: 13 }));
  parts.push(paragraph(escapeHtml(t('cancellation')), { muted: true, size: 13 }));
  parts.push(closing(d.locale));

  return shell({
    locale: d.locale,
    title: bookingEmailSubject(d),
    preheader: t(`preheader.${d.event}`, { reference: d.reference }),
    heading: t(`heading.${d.event}`),
    body: parts.join(''),
  });
}

function bookingEmailText(d: BookingEmailData): string {
  const t = translator(d.locale, 'email.booking');
  const c = translator(d.locale, 'email.common');
  const lines = [
    t('hello', { firstName: d.firstName }),
    '',
    `${t('labels.reference')}: ${d.reference}`,
    `${t('labels.class')}: ${d.className}`,
    d.instructor ? `${t('labels.instructor')}: ${d.instructor}` : '',
    `${t('labels.date')}: ${formatEmailDate(d.startsAt, d.locale)}`,
    `${t('labels.time')}: ${formatEmailTime(d.startsAt, d.durationMinutes)} (${c('timezone')})`,
    `${t('labels.location')}: ${d.location}`,
    `${t(d.event === 'pending' ? 'labels.amountDue' : 'labels.total')}: ${Number(d.totalUsd) === 0 ? t('free') : formatUsd(Number(d.totalUsd))}`,
    '',
    c('questions'),
    `${BUSINESS.phoneDisplay} · ${BUSINESS.email.yogaStudio}`,
  ];
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n');
}

function bookingIcs(d: BookingEmailData): { filename: string; content: string; contentType: string } {
  const ics = generateICS({
    uid: d.reference,
    title: `${d.className} — House of Shakti`,
    description: `${d.instructor ? `${d.instructor} · ` : ''}House of Shakti. Ref: ${d.reference}`,
    location: `${d.location}, House of Shakti, Santa Teresa, Costa Rica`,
    startsAt: new Date(d.startsAt),
    durationMinutes: d.durationMinutes,
    organizerName: 'House of Shakti',
    organizerEmail: BUSINESS.email.yogaStudio,
  });
  return {
    filename: 'house-of-shakti-class.ics',
    content: Buffer.from(ics, 'utf8').toString('base64'),
    contentType: 'text/calendar',
  };
}

export async function sendBookingEmail(d: BookingEmailData): Promise<SendResult> {
  return deliver({
    to: d.to,
    subject: bookingEmailSubject(d),
    html: bookingEmailHtml(d),
    text: bookingEmailText(d),
    attachments: d.event === 'cancelled' ? undefined : [bookingIcs(d)],
    tag: `booking:${d.event}:${d.reference}`,
    // Classes and packs are the shala's business: a reply reaches the studio.
    replyTo: BUSINESS.email.yogaStudio,
  });
}

// ─── Class pack code ─────────────────────────────────────────────────────────
export type PackCodeEmail = {
  to: string;
  firstName: string;
  code: string;
  packName: string;
  classesTotal: number;
  /** Set when resending: how many classes are still unused. */
  classesRemaining?: number;
  /** The language the pack was bought in. Defaults to English. */
  locale?: AppLocale;
};

export function packCodeHtml(params: PackCodeEmail): string {
  const { firstName, code, packName, classesTotal, classesRemaining, locale = routing.defaultLocale } = params;
  const t = translator(locale, 'email.packCode');
  const parts = [
    paragraph(escapeHtml(t('hello', { firstName }))),
    paragraph(t.markup('thanks', { packName: escapeHtml(packName), count: classesTotal, strong })),
    paragraph(escapeHtml(t('useCode'))),
    bigCode(code),
    paragraph(escapeHtml(t('works', { count: classesTotal })), { muted: true, size: 13 }),
  ];
  if (classesRemaining != null && classesRemaining !== classesTotal) {
    parts.push(paragraph(escapeHtml(t('remaining', { count: classesRemaining })), { muted: true, size: 13 }));
  }
  parts.push(button(t('bookNow'), `${BUSINESS.url}${localizedPath('/yoga', locale)}`));
  parts.push(closing(locale));
  return shell({
    locale,
    title: t('subject', { packName }),
    preheader: t('preheader', { code }),
    heading: t('heading'),
    body: parts.join(''),
  });
}

export async function sendPackCodeEmail(params: PackCodeEmail): Promise<SendResult> {
  const { to, code, packName, classesTotal, locale = routing.defaultLocale } = params;
  const t = translator(locale, 'email.packCode');
  return deliver({
    to,
    subject: t('subject', { packName }),
    html: packCodeHtml(params),
    text: [t('hello', { firstName: params.firstName }), '', t('useCode'), '', code, '', t('works', { count: classesTotal })].join('\n'),
    tag: `pack-code:${classesTotal}`,
    // Classes and packs are the shala's business: a reply reaches the studio.
    replyTo: BUSINESS.email.yogaStudio,
  });
}

// ─── Heads-up to the studio ──────────────────────────────────────────────────
// Opt-in: set BOOKING_NOTIFY_EMAIL (one address, or several separated by
// commas) and the studio hears about every new booking the moment it lands —
// most usefully a cash or Venmo hold that someone has to collect.
export type AdminNotification = {
  kind: 'booking' | 'pack';
  /** confirmed: paid · pending: cash / Venmo to collect · review: a card payment to verify by hand */
  status: 'confirmed' | 'pending' | 'review';
  customerName: string;
  customerEmail: string;
  summary: string;
  /** Lines of "Label: value". */
  details: string[];
  adminPath: string;
};

export async function sendAdminNotification(n: AdminNotification): Promise<SendResult> {
  const raw = process.env.BOOKING_NOTIFY_EMAIL?.trim();
  if (!raw) return { sent: false, skipped: true };
  const to = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const kindWord = n.status === 'review' ? 'Card payment to verify' : n.status === 'pending' ? 'Payment to collect' : n.kind === 'pack' ? 'New pack' : 'New booking';
  const subject = `[House of Shakti] ${kindWord} · ${n.customerName} · ${n.summary}`;
  const detailRows = n.details.map((line) => {
    const [label, ...rest] = line.split(':');
    return { label: label.trim(), value: escapeHtml(rest.join(':').trim()) };
  });
  const body =
    paragraph(`${escapeHtml(n.customerName)} · <a href="mailto:${escapeHtml(n.customerEmail)}" style="color:${INK};">${escapeHtml(n.customerEmail)}</a>`) +
    detailTable(detailRows) +
    button('Open in the admin panel', `${BUSINESS.url}${n.adminPath}`);
  const html = shell({
    locale: 'en',
    title: subject,
    preheader: n.summary,
    heading: n.status === 'review' ? 'A card payment to verify' : n.status === 'pending' ? 'A payment to collect' : n.kind === 'pack' ? 'A new pack' : 'A new booking',
    body,
  });
  return deliver({
    to,
    subject,
    html,
    text: [`${n.customerName} <${n.customerEmail}>`, ...n.details, `${BUSINESS.url}${n.adminPath}`].join('\n'),
    tag: `admin:${n.kind}:${n.status}`,
  });
}
