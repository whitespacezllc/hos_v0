import { addDays } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  costaRicaDateString,
  costaRicaInstant,
  costaRicaTimeString,
  costaRicaWeekStart,
  inCostaRica,
  toInstantIso,
} from '@/lib/costa-rica-time';

// ─── The recurring schedule and its sessions ─────────────────────────────────
// A recurring class (class_templates) is materialized into dated sessions
// (classes) ~3 months ahead, on every admin page load and on every visit to
// /yoga. Those sessions are copies: nothing in the database keeps them in step
// with their template afterwards. This module does — when a template is
// edited, deleted, or found with sessions that no longer match it.

type Db = SupabaseClient<Database>;
type TemplateRow = Database['public']['Tables']['class_templates']['Row'];
type ClassUpdate = Database['public']['Tables']['classes']['Update'];

/** What an admin action answers. Expected failures are values, never throws. */
export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: 'not_admin' | 'save_failed' | 'delete_failed' };

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * A slug for a new recurring class that no other one has. `class_templates.slug`
 * is UNIQUE, and two classes may well share a name (Vinyasa Krama on Tuesdays
 * and on Thursdays), so the second one gets a numbered slug.
 */
export async function uniqueTemplateSlug(db: Db, name: string): Promise<string> {
  const base = slugify(name) || 'class';
  const { data } = await db.from('class_templates').select('slug').like('slug', `${base}%`);
  const taken = new Set((data ?? []).map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

const hhmm = (time: string) => time.slice(0, 5);
const ms = (instant: string) => new Date(instant).getTime();

// The instant of a template's slot in the Costa Rica week of `instant`.
function slotInWeekOf(instant: string, dayOfWeek: number, timeStart: string): string {
  const monday = costaRicaWeekStart(instant);
  const date = addDays(monday, (dayOfWeek + 6) % 7); // 0=Sun … 6=Sat → offset from Monday
  return toInstantIso(costaRicaInstant(costaRicaDateString(date), hhmm(timeStart)));
}

// Whether the session happens on its template's weekday and time (Costa Rica).
function onSlot(startsAt: string, dayOfWeek: number, timeStart: string): boolean {
  return (
    inCostaRica(startsAt).getDay() === dayOfWeek && costaRicaTimeString(startsAt) === hhmm(timeStart)
  );
}

const SESSION_FIELDS = 'id, starts_at, capacity, spots_remaining, is_active';
type Session = {
  id: string;
  starts_at: string;
  capacity: number;
  spots_remaining: number;
  is_active: boolean;
};

/**
 * Removes a session nobody is in. Both writes hold only while it is still
 * empty, so a booking landing meanwhile is never orphaned. Bookings that were
 * cancelled still reference the row; when that keeps it from going, it is
 * switched off instead, which takes it off the schedule just the same.
 */
async function dropEmptySession(
  db: Db,
  session: { id: string; capacity: number },
): Promise<'deleted' | 'deactivated' | 'skipped'> {
  const { data: deleted, error } = await db
    .from('classes')
    .delete()
    .eq('id', session.id)
    .eq('spots_remaining', session.capacity)
    .select('id');
  if (!error) return deleted.length > 0 ? 'deleted' : 'skipped';

  const { data: off } = await db
    .from('classes')
    .update({ is_active: false })
    .eq('id', session.id)
    .eq('spots_remaining', session.capacity)
    .select('id');
  return off && off.length > 0 ? 'deactivated' : 'skipped';
}

// The template fields a session copies at materialization and keeps in sync
// with afterwards. Capacity and the slot (day + time) need their own handling.
const FOLLOWED_FIELDS = [
  'name',
  'description',
  'instructor_id',
  'duration_minutes',
  'location',
  'color',
  'price_dropin_usd',
  'image_url',
] as const;

/**
 * Carries a template edit over to its upcoming sessions, which would otherwise
 * keep the old values — and, on a day or time change, sit next to a second
 * session at the new slot. A session only follows a field it still shares with
 * the old template: one edited on its own in the calendar (a substitute
 * teacher, a special price) keeps its own value. Sessions people already booked
 * keep their day and time — moving them would change a class someone paid for —
 * and are counted so the admin can sort them out; the new slot is materialized
 * next to them.
 */
export async function syncUpcomingSessions(
  db: Db,
  before: TemplateRow,
  after: TemplateRow,
): Promise<{ keptWithBookings: number }> {
  const nowIso = new Date().toISOString();

  for (const field of FOLLOWED_FIELDS) {
    const oldValue = before[field];
    const newValue = after[field];
    if (oldValue === newValue) continue;
    const query = db
      .from('classes')
      .update({ [field]: newValue } as ClassUpdate)
      .eq('template_id', after.id)
      .gte('starts_at', nowIso);
    const { error } = await (oldValue === null ? query.is(field, null) : query.eq(field, oldValue));
    if (error) console.error('[syncUpcomingSessions]', field, error.message);
  }

  const capacityChanged = before.capacity !== after.capacity;
  const slotChanged =
    before.day_of_week !== after.day_of_week ||
    hhmm(before.time_start) !== hhmm(after.time_start);
  if (!capacityChanged && !slotChanged) return { keptWithBookings: 0 };

  // From the start of this week: a session at the new slot may already exist
  // earlier in the week, and must not be duplicated by moving another onto it.
  const { data: sessions, error } = await db
    .from('classes')
    .select(SESSION_FIELDS)
    .eq('template_id', after.id)
    .gte('starts_at', toInstantIso(costaRicaWeekStart()))
    .order('starts_at', { ascending: true });
  if (error) {
    console.error('[syncUpcomingSessions]', error.message);
    return { keptWithBookings: 0 };
  }

  const taken = new Set(sessions.map((s) => ms(s.starts_at)));
  const now = Date.now();
  let keptWithBookings = 0;

  for (const session of sessions) {
    if (ms(session.starts_at) < now) continue;

    let current: Session | null = session;
    let kept = false;
    // A booking can land between the read and the write; the update is
    // conditional on spots_remaining, and on a miss the session is read again.
    for (let attempt = 0; current && attempt < 3; attempt++) {
      const occupied = Math.max(0, current.capacity - current.spots_remaining);
      const patch: ClassUpdate = {};
      kept = false;

      if (capacityChanged && current.capacity === before.capacity) {
        patch.capacity = after.capacity;
        patch.spots_remaining = Math.max(0, after.capacity - occupied);
      }

      const from = ms(current.starts_at);
      const onOldSlot =
        slotChanged &&
        from === ms(slotInWeekOf(current.starts_at, before.day_of_week, before.time_start));
      let to: number | null = null;
      if (onOldSlot && occupied > 0) {
        kept = current.is_active;
      } else if (onOldSlot) {
        const target = slotInWeekOf(current.starts_at, after.day_of_week, after.time_start);
        if (taken.has(ms(target))) {
          // The new slot already has its session that week.
          await dropEmptySession(db, current);
          break;
        }
        patch.starts_at = target;
        to = ms(target);
      }

      if (Object.keys(patch).length === 0) break;
      const { data: written, error: writeError } = await db
        .from('classes')
        .update(patch)
        .eq('id', current.id)
        .eq('spots_remaining', current.spots_remaining)
        .select('id');
      if (writeError) {
        console.error('[syncUpcomingSessions]', current.id, writeError.message);
        break;
      }
      if (written.length > 0) {
        if (to !== null) {
          taken.delete(from);
          taken.add(to);
        }
        break;
      }
      const id: string = current.id;
      const { data: reread } = await db
        .from('classes')
        .select(SESSION_FIELDS)
        .eq('id', id)
        .maybeSingle<Session>();
      current = reread;
    }
    if (kept) keptWithBookings++;
  }

  return { keptWithBookings };
}

/**
 * Removes upcoming sessions that have drifted off their template's day or time
 * and that nobody booked. They come from a day or time change that didn't reach
 * the sessions (edits made before `syncUpcomingSessions` existed): the
 * materializer only ever fills the template's own slot, so to it they are
 * extras — but they show on the schedule and can be booked. A session with
 * bookings is never touched; one moved by hand in the calendar is a one-off by
 * then (`updateClassInstance` detaches it) and is not looked at. The current
 * week is cleaned from its Monday — the public page shows the whole week, and
 * a stray session that nobody booked is no history worth keeping. Runs on
 * every admin page load; cheap, and idempotent.
 */
export async function reconcileTemplateSessions(db: Db): Promise<number> {
  const [{ data: templates, error: templatesError }, { data: sessions, error: sessionsError }] =
    await Promise.all([
      db.from('class_templates').select('id, day_of_week, time_start'),
      db
        .from('classes')
        .select('id, template_id, starts_at, capacity, spots_remaining')
        .not('template_id', 'is', null)
        .gte('starts_at', toInstantIso(costaRicaWeekStart())),
    ]);
  if (templatesError || sessionsError) {
    console.error('[reconcileTemplateSessions]', templatesError?.message ?? sessionsError?.message);
    return 0;
  }

  const slots = new Map(templates.map((t) => [t.id, t]));
  const stale = sessions.filter((s) => {
    const template = s.template_id ? slots.get(s.template_id) : undefined;
    if (!template) return false;
    const empty = s.spots_remaining >= s.capacity;
    return empty && !onSlot(s.starts_at, template.day_of_week, template.time_start);
  });

  let removed = 0;
  for (const session of stale) {
    if ((await dropEmptySession(db, session)) !== 'skipped') removed++;
  }
  return removed;
}

/** Upcoming sessions of a template that people are booked into, and how many people. */
export async function upcomingBookings(
  db: Db,
  templateId: string,
): Promise<{ sessions: number; persons: number }> {
  const { data: upcoming } = await db
    .from('classes')
    .select('id')
    .eq('template_id', templateId)
    .eq('is_active', true)
    .gte('starts_at', new Date().toISOString());
  const ids = (upcoming ?? []).map((s) => s.id);
  if (ids.length === 0) return { sessions: 0, persons: 0 };

  const { data: bookings } = await db
    .from('bookings')
    .select('class_id, persons')
    .in('class_id', ids)
    .in('payment_status', ['pending', 'confirmed']);
  const booked = new Set<string>();
  let persons = 0;
  for (const b of bookings ?? []) {
    booked.add(b.class_id);
    persons += b.persons;
  }
  return { sessions: booked.size, persons };
}

/**
 * Takes a recurring class's sessions off the schedule ahead of deleting it.
 * Upcoming sessions nobody is in are removed; those with bookings are switched
 * off and counted — their bookings stay, for the admin to contact. Every
 * session that remains (past ones, history) is detached from the template, as
 * the one-off it now is, so the template row itself can go.
 */
export async function releaseTemplateSessions(
  db: Db,
  templateId: string,
): Promise<{ keptWithBookings: number }> {
  const { data: upcoming, error } = await db
    .from('classes')
    .select('id, capacity, spots_remaining, is_active')
    .eq('template_id', templateId)
    .gte('starts_at', new Date().toISOString());
  if (error) throw new Error(error.message);

  let keptWithBookings = 0;
  for (const session of upcoming) {
    const empty = session.spots_remaining >= session.capacity;
    if (empty && (await dropEmptySession(db, session)) !== 'skipped') continue;
    // Someone is in it (or just got in): keep it, off the schedule.
    const { error: offError } = await db
      .from('classes')
      .update({ is_active: false })
      .eq('id', session.id);
    if (offError) throw new Error(offError.message);
    if (session.is_active) keptWithBookings++;
  }

  const { error: detachError } = await db
    .from('classes')
    .update({ template_id: null })
    .eq('template_id', templateId);
  if (detachError) throw new Error(detachError.message);

  return { keptWithBookings };
}
