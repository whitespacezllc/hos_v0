'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import type { Database } from '@/types/supabase';
import type { ClassInstancePayload } from '@/types';
import { requireAdmin } from '@/lib/auth/require-admin';
import { addDays } from 'date-fns';
import {
  costaRicaDateString,
  costaRicaInstant,
  costaRicaWeekStart,
  toInstantIso,
} from '@/lib/costa-rica-time';

type ClassInsert = Database['public']['Tables']['classes']['Insert'];
type ClassUpdate = Partial<Database['public']['Tables']['classes']['Update']>;
type TemplateInsert = Database['public']['Tables']['class_templates']['Insert'];
type TemplateUpdate = Database['public']['Tables']['class_templates']['Update'];


// Monday (yyyy-MM-dd) of the Costa Rica week containing `date`. The server
// runs in UTC; the schedule lives in Santa Teresa.
function mondayOf(date: Date): string {
  return costaRicaDateString(costaRicaWeekStart(date));
}

// How many weeks ahead the calendar materializes the recurring schedule.
// 13 weeks ≈ 3 months, so admins can organize and let clients plan well ahead.
// Kept in sync with MAX_WEEKS_AHEAD in lib/queries/classes.ts (the on-read cap).
const WEEKS_AHEAD = 13;

/**
 * Ensures the recurring schedule is materialized into `classes` for the current
 * week and the next ~3 months. Idempotent (the RPC skips instances that already
 * exist), so it's safe to call on every admin page load — this replaces the
 * manual "Regenerate week" button and widens the planning window.
 */
export async function ensureUpcomingWeeks(): Promise<void> {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const now = new Date();

  // Distinct Mondays for weeks 0..WEEKS_AHEAD.
  const weeks = Array.from(new Set(
    Array.from({ length: WEEKS_AHEAD + 1 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + i * 7);
      return mondayOf(d);
    }),
  ));

  // Materialize in parallel; the RPC is idempotent so concurrent inserts are safe.
  await Promise.all(
    weeks.map(async (weekStart) => {
      const { error } = await supabase.rpc('generate_week_classes', {
        p_week_start: weekStart,
      });
      if (error) {
        console.error('[ensureUpcomingWeeks]', weekStart, error.message);
      }
    }),
  );
}

// ─── Class templates (recurring weekly schedule) ────────────────────────────
export async function createTemplate(data: TemplateInsert) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('class_templates').insert(data);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
}

export async function updateTemplate(
  id: string,
  data: TemplateUpdate,
): Promise<{ keptWithBookings: number }> {
  await requireAdmin();
  const supabase = await createServiceClient();

  const { data: before, error: readError } = await supabase
    .from('class_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (readError) throw new Error(readError.message);

  const { data: after, error } = await supabase
    .from('class_templates')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const result = await syncUpcomingSessions(supabase, before, after);

  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
  return result;
}

type TemplateRow = Database['public']['Tables']['class_templates']['Row'];
type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// The template fields a session copies at materialization and keeps in sync
// with afterwards. Capacity and the slot (day + time) need their own handling.
const FOLLOWED_FIELDS = [
  'name',
  'slug',
  'description',
  'instructor_id',
  'duration_minutes',
  'location',
  'color',
  'price_dropin_usd',
  'image_url',
] as const;

const SESSION_FIELDS = 'id, starts_at, capacity, spots_remaining, is_active';
type Session = { id: string; starts_at: string; capacity: number; spots_remaining: number; is_active: boolean };

const hhmm = (time: string) => time.slice(0, 5);

// The instant of the template's slot in the Costa Rica week of `instant`.
function slotInWeekOf(instant: string, dayOfWeek: number, timeStart: string): string {
  const monday = costaRicaWeekStart(instant);
  const date = addDays(monday, (dayOfWeek + 6) % 7); // 0=Sun … 6=Sat → offset from Monday
  return toInstantIso(costaRicaInstant(costaRicaDateString(date), hhmm(timeStart)));
}

/**
 * Carries a template edit over to its upcoming sessions, which are materialized
 * ~3 months ahead and would otherwise keep the old values — and, on a day or
 * time change, sit next to a second session at the new slot. A session only
 * follows a field it still shares with the old template: one edited on its own
 * in the calendar (a substitute teacher, a special price, a moved session)
 * keeps its own value. Sessions people already booked keep their day and time
 * — moving them would change a class someone paid for — and are counted so the
 * admin can sort them out; the new slot is materialized next to them.
 */
async function syncUpcomingSessions(
  supabase: ServiceClient,
  before: TemplateRow,
  after: TemplateRow,
): Promise<{ keptWithBookings: number }> {
  const nowIso = new Date().toISOString();

  for (const field of FOLLOWED_FIELDS) {
    const oldValue = before[field];
    const newValue = after[field];
    if (oldValue === newValue) continue;
    const query = supabase
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
  const { data: sessions, error } = await supabase
    .from('classes')
    .select(SESSION_FIELDS)
    .eq('template_id', after.id)
    .gte('starts_at', toInstantIso(costaRicaWeekStart()))
    .order('starts_at', { ascending: true });
  if (error) {
    console.error('[syncUpcomingSessions]', error.message);
    return { keptWithBookings: 0 };
  }

  const ms = (instant: string) => new Date(instant).getTime();
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
          // Nobody is in it and the new slot already has its session. Both
          // writes hold only while it is still empty; bookings that were
          // cancelled still reference it, so when the row can't go it is
          // switched off instead.
          const { error: deleteError } = await supabase
            .from('classes')
            .delete()
            .eq('id', current.id)
            .eq('spots_remaining', current.capacity);
          if (deleteError) {
            await supabase
              .from('classes')
              .update({ is_active: false })
              .eq('id', current.id)
              .eq('spots_remaining', current.capacity);
          }
          break;
        }
        patch.starts_at = target;
        to = ms(target);
      }

      if (Object.keys(patch).length === 0) break;
      const { data: written, error: writeError } = await supabase
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
      const { data: reread } = await supabase
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

export async function toggleTemplateActive(id: string) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { data: current, error: fetchError } = await supabase
    .from('class_templates')
    .select('is_active')
    .eq('id', id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase
    .from('class_templates')
    .update({ is_active: !current.is_active })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
}

/**
 * Deletes a recurring class. Future instances (not yet started) are removed too;
 * past instances are kept so bookings/metrics history stays intact. If a past
 * instance blocks the hard delete (FK), fall back to deactivating the template.
 */
export async function deleteTemplate(id: string) {
  await requireAdmin();
  const supabase = await createServiceClient();

  await supabase
    .from('classes')
    .delete()
    .eq('template_id', id)
    .gte('starts_at', new Date().toISOString());

  const { error } = await supabase.from('class_templates').delete().eq('id', id);
  if (error) {
    // Likely referenced by past classes — deactivate instead of hard-deleting.
    const { error: deactivateError } = await supabase
      .from('class_templates')
      .update({ is_active: false })
      .eq('id', id);
    if (deactivateError) throw new Error(deactivateError.message);
  }

  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
}

export async function toggleClassActive(id: string) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { data: current, error: fetchError } = await supabase
    .from('classes')
    .select('is_active')
    .eq('id', id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase
    .from('classes')
    .update({ is_active: !current.is_active })
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
}

export async function updateClassDetails(id: string, data: ClassUpdate) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from('classes')
    .update(data)
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
}

export async function deleteClass(id: string) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from('classes')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
}

export async function createManualClass(data: ClassInsert) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('classes').insert(data);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
}

// ─── Single-session (instance) create / edit from the calendar ──────────────
// A dated, one-off `classes` row (not a recurring template). Used by the
// calendar's tap-to-create and the drawer's Edit action.
// (ClassInstancePayload lives in @/types — 'use server' files may only export
// async functions, so the shared type can't be declared here.)

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export async function createClassInstance(payload: ClassInstancePayload) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('classes').insert({
    name: payload.name,
    slug: slugify(payload.name) || 'class',
    description: payload.description,
    instructor_id: payload.instructor_id,
    starts_at: payload.starts_at,
    duration_minutes: payload.duration_minutes,
    capacity: payload.capacity,
    // A brand-new session starts fully available.
    spots_remaining: payload.capacity,
    price_dropin_usd: payload.price_dropin_usd,
    location: payload.location,
    image_url: payload.image_url,
    is_active: payload.is_active,
    template_id: null,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
}

export async function updateClassInstance(id: string, payload: ClassInstancePayload) {
  await requireAdmin();
  const supabase = await createServiceClient();

  // Preserve existing bookings when capacity changes: keep `occupied` fixed and
  // recompute remaining spots against the new capacity.
  const { data: current } = await supabase
    .from('classes')
    .select('capacity, spots_remaining')
    .eq('id', id)
    .single();

  const occupied = current ? Math.max(0, current.capacity - current.spots_remaining) : 0;
  const spotsRemaining = Math.max(0, payload.capacity - occupied);

  const { error } = await supabase
    .from('classes')
    .update({
      name: payload.name,
      slug: slugify(payload.name) || 'class',
      description: payload.description,
      instructor_id: payload.instructor_id,
      starts_at: payload.starts_at,
      duration_minutes: payload.duration_minutes,
      capacity: payload.capacity,
      spots_remaining: spotsRemaining,
      price_dropin_usd: payload.price_dropin_usd,
      location: payload.location,
      image_url: payload.image_url,
      is_active: payload.is_active,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
}
