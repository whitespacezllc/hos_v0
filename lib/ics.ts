import { addMinutes } from 'date-fns';
import { BUSINESS, EMAIL_DOMAIN } from '@/lib/business';

type ICSParams = {
  uid: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  durationMinutes: number;
  organizerName?: string;
  /** The mailbox that answers about this event. The general one when unset. */
  organizerEmail?: string;
};

// UTC, with the trailing Z: `20260911T130000Z`. A floating local time (no Z)
// would mean "07:00 wherever the reader's calendar is", which is only right
// for a reader in Costa Rica. An instant is right for everyone — the calendar
// shows it in its own zone, and in Santa Teresa that is 07:00.
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Commas, semicolons and backslashes are structural in iCalendar text values.
function escapeICSText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function generateICS(params: ICSParams): string {
  const { uid, title, description, location, startsAt, durationMinutes, organizerName, organizerEmail } = params;
  const endsAt = addMinutes(startsAt, durationMinutes);
  const now = formatICSDate(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//House of Shakti//Yoga Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Canonical domain — this used to read `houseofshakti.com`, which is not a
    // domain the business owns and disagreed with every address on the site.
    `UID:${uid}@${EMAIL_DOMAIN}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatICSDate(startsAt)}`,
    `DTEND:${formatICSDate(endsAt)}`,
    `SUMMARY:${escapeICSText(title)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    `LOCATION:${escapeICSText(location)}`,
    `URL:${BUSINESS.url}/yoga`,
    // The mailbox that answers about this event — the studio's for a class —
    // falling back to the general one. (`info@` was once invented here and
    // lived on a domain the business does not own.)
    organizerName
      ? `ORGANIZER;CN=${escapeICSText(organizerName)}:mailto:${organizerEmail ?? BUSINESS.email.general}`
      : '',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

export function downloadICS(params: ICSParams, filename: string): void {
  const content = generateICS(params);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
