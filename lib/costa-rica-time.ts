import { TZDate } from '@date-fns/tz';
import { addDays, startOfWeek } from 'date-fns';

// ─── Costa Rica time, everywhere ─────────────────────────────────────────────
// The studio is in Santa Teresa. Every class is scheduled, shown, booked and
// emailed in Costa Rica time (UTC−6, no daylight saving), no matter where the
// reader, the admin or the server happens to be. Postgres stores instants
// (timestamptz); this module is the one place that turns an instant into
// Santa Teresa wall-clock time and back.
//
// `TZDate` is a `Date` whose getters (getHours, getDay, …) answer in the given
// zone, so date-fns' format / isSameDay / startOfWeek work unchanged on it.
// Two rules keep it honest:
//   · pass the TZDate as the FIRST argument to two-date helpers (isSameDay,
//     isWithinInterval…): date-fns normalizes the rest to the first one's zone.
//   · serialize with `toInstantIso`, never `.toISOString()` on a TZDate — the
//     latter carries the -06:00 offset, which is valid but not what the rest of
//     the app expects to compare against.

export const COSTA_RICA_TZ = 'America/Costa_Rica';

/** Fixed offset: Costa Rica has never observed daylight saving. */
export const COSTA_RICA_OFFSET = '-06:00';

export type Instant = Date | string | number;

function toMs(value: Instant): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/** The instant, seen from Santa Teresa. */
export function inCostaRica(value: Instant): TZDate {
  return new TZDate(toMs(value), COSTA_RICA_TZ);
}

/** Now, in Santa Teresa. */
export function nowInCostaRica(): TZDate {
  return TZDate.tz(COSTA_RICA_TZ);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of the Costa Rica calendar day the instant falls on. */
export function costaRicaDateString(value: Instant): string {
  const d = inCostaRica(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `HH:mm` on the Costa Rica clock. */
export function costaRicaTimeString(value: Instant): string {
  const d = inCostaRica(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The instant at which a Costa Rica wall-clock date (`YYYY-MM-DD`) and time (`HH:mm`) happen. */
export function costaRicaInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${COSTA_RICA_OFFSET}`);
}

/** The instant as a UTC ISO string (`…Z`), whatever kind of Date it came from. */
export function toInstantIso(value: Instant): string {
  return new Date(toMs(value)).toISOString();
}

/** Monday 00:00 (Costa Rica) of the week containing the instant. */
export function costaRicaWeekStart(value: Instant = nowInCostaRica()): TZDate {
  return startOfWeek(inCostaRica(value), { weekStartsOn: 1 });
}

/**
 * The seven days, Monday to Sunday, of the week `weekOffset` weeks away from
 * the one containing `from`. Each is midnight in Costa Rica.
 */
export function costaRicaWeekDays(weekOffset = 0, from: Instant = nowInCostaRica()): TZDate[] {
  const monday = addDays(costaRicaWeekStart(from), weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
