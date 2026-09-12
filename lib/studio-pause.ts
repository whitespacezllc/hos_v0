import { costaRicaDateString, type Instant } from '@/lib/costa-rica-time';

// ─── The studio's pause ──────────────────────────────────────────────────────
// The shala holds its last classes in the week of 14 September 2026 and
// reopens on 1 November. The weeks in between carry a notice on the schedule,
// in the owners' words (messages: yoga.calendar.pause).
//
// The notice belongs to the weeks it describes, not to the day the reader
// happens to visit. Someone looking at the last week of classes sees the
// classes and nothing else; clicking forward into the pause, they meet the
// notice over the empty grid that needs explaining. From 21 September the
// current week is itself a paused one, so the notice is simply there.
//
// It retires itself too: on the morning of the reopening, Santa Teresa time,
// no week on the schedule is paused any more and the notice is gone without a
// deploy. The sentence that names the date lives in the catalogue, so moving
// either date means moving the other.

/** First day without classes — the Monday the pause begins. */
export const STUDIO_PAUSE_FROM = '2026-09-21';

/** First day classes resume. */
export const STUDIO_REOPENS_ON = '2026-11-01';

/** Whether one day falls inside the pause, on the Costa Rica calendar. */
export function isStudioPaused(day: Instant): boolean {
  const date = costaRicaDateString(day);
  return date >= STUDIO_PAUSE_FROM && date < STUDIO_REOPENS_ON;
}

/** Whether a week shown on the schedule touches the pause at all. */
export function weekTouchesStudioPause(days: Instant[]): boolean {
  return days.some(isStudioPaused);
}
