import { costaRicaDateString, nowInCostaRica, type Instant } from '@/lib/costa-rica-time';

// ─── The studio's pause ──────────────────────────────────────────────────────
// The shala closes after the week of 14 September 2026 and reopens on
// 1 November. Until then the schedule carries a notice saying so, in the
// owners' words (messages: yoga.calendar.pause). The date here decides whether
// the notice shows; the sentence that names the date lives in the catalogue,
// so a change to one has to be made in the other too.
//
// The notice retires itself: on the morning of the reopening, Santa Teresa
// time, it is gone without a deploy.

/** First day classes resume, as a Costa Rica calendar date (`YYYY-MM-DD`). */
export const STUDIO_REOPENS_ON = '2026-11-01';

/** Whether the pause notice belongs on the schedule at this instant. */
export function isStudioPauseNoticeVisible(now: Instant = nowInCostaRica()): boolean {
  return costaRicaDateString(now) < STUDIO_REOPENS_ON;
}
