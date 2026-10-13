'use server';

import { revalidatePath } from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/service';
import type { Database } from '@/types/supabase';
import type { ClassInstancePayload } from '@/types';
import { isAdminSession } from '@/lib/auth/require-admin';
import { costaRicaDateString, costaRicaWeekStart } from '@/lib/costa-rica-time';
import {
  type ActionResult,
  reconcileTemplateSessions,
  releaseTemplateSessions,
  slugify,
  syncUpcomingSessions,
  uniqueTemplateSlug,
  upcomingBookings,
} from '@/lib/schedule/sessions';

type ClassUpdate = Partial<Database['public']['Tables']['classes']['Update']>;
type TemplateInsert = Database['public']['Tables']['class_templates']['Insert'];
type TemplateUpdate = Database['public']['Tables']['class_templates']['Update'];

// Every action here answers with a result the panel can show, never with a
// throw: a thrown error in a server action reaches the browser as a blank
// "Application error" page, which is what admins used to see when, say, a new
// class collided with another's slug.
const NOT_ADMIN = { ok: false, error: 'not_admin' } as const;
const SAVE_FAILED = { ok: false, error: 'save_failed' } as const;
const DELETE_FAILED = { ok: false, error: 'delete_failed' } as const;

function revalidateSchedule() {
  revalidatePath('/admin');
  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
}

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
 * week and the next ~3 months, and that no session has strayed from its
 * template's day and time. Idempotent (the RPC skips instances that already
 * exist), so it's safe to call on every admin page load — this replaces the
 * manual "Regenerate week" button and widens the planning window.
 */
export async function ensureUpcomingWeeks(): Promise<void> {
  if (!(await isAdminSession())) return;
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

  try {
    const removed = await reconcileTemplateSessions(supabase);
    if (removed > 0) console.info('[ensureUpcomingWeeks] removed', removed, 'stale sessions');
  } catch (err) {
    console.error('[ensureUpcomingWeeks] reconcile', err);
  }
}

// ─── Class templates (recurring weekly schedule) ────────────────────────────
export async function createTemplate(data: TemplateInsert): Promise<ActionResult> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const supabase = createServiceRoleClient();

  // The slug is the server's to pick: it must be unique, and the form can't know
  // what's taken. A collision with a class created meanwhile is retried once.
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = await uniqueTemplateSlug(supabase, data.name);
    const { error } = await supabase.from('class_templates').insert({ ...data, slug });
    if (!error) {
      revalidateSchedule();
      return { ok: true };
    }
    if (error.code !== '23505') {
      console.error('[createTemplate]', error.message);
      return SAVE_FAILED;
    }
  }
  return SAVE_FAILED;
}

export async function updateTemplate(
  id: string,
  data: TemplateUpdate,
): Promise<ActionResult<{ keptWithBookings: number }>> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const supabase = createServiceRoleClient();

  const { data: before, error: readError } = await supabase
    .from('class_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (readError) {
    console.error('[updateTemplate]', readError.message);
    return SAVE_FAILED;
  }

  // The slug stays what it was: it is unique, and nothing shows it but this list.
  const { slug: _slug, ...changes } = data;
  void _slug;
  const { data: after, error } = await supabase
    .from('class_templates')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error('[updateTemplate]', error.message);
    return SAVE_FAILED;
  }

  let keptWithBookings = 0;
  try {
    ({ keptWithBookings } = await syncUpcomingSessions(supabase, before, after));
    await reconcileTemplateSessions(supabase);
  } catch (err) {
    // The template is saved; the sessions catch up on the next page load.
    console.error('[updateTemplate] sync', err);
  }

  revalidateSchedule();
  return { ok: true, keptWithBookings };
}

export async function toggleTemplateActive(id: string): Promise<ActionResult> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const supabase = createServiceRoleClient();
  const { data: current, error: fetchError } = await supabase
    .from('class_templates')
    .select('is_active')
    .eq('id', id)
    .single();
  if (fetchError) {
    console.error('[toggleTemplateActive]', fetchError.message);
    return SAVE_FAILED;
  }

  const { error } = await supabase
    .from('class_templates')
    .update({ is_active: !current.is_active })
    .eq('id', id);
  if (error) {
    console.error('[toggleTemplateActive]', error.message);
    return SAVE_FAILED;
  }
  revalidateSchedule();
  return { ok: true };
}

/** For the delete confirmation: how many upcoming sessions have people booked. */
export async function upcomingBookingsForTemplate(
  id: string,
): Promise<ActionResult<{ sessions: number; persons: number }>> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  try {
    const summary = await upcomingBookings(createServiceRoleClient(), id);
    return { ok: true, ...summary };
  } catch (err) {
    console.error('[upcomingBookingsForTemplate]', err);
    return SAVE_FAILED;
  }
}

/**
 * Deletes a recurring class for good. Upcoming sessions nobody is in go with
 * it; those with bookings are taken off the schedule and counted (their
 * bookings stay). Past sessions keep the history as one-offs.
 */
export async function deleteTemplate(
  id: string,
): Promise<ActionResult<{ keptWithBookings: number }>> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const supabase = createServiceRoleClient();

  let keptWithBookings = 0;
  try {
    ({ keptWithBookings } = await releaseTemplateSessions(supabase, id));
  } catch (err) {
    console.error('[deleteTemplate] sessions', err);
    return DELETE_FAILED;
  }

  const { error } = await supabase.from('class_templates').delete().eq('id', id);
  if (error) {
    // Nothing should reference it any more; if something still does, at least
    // take it off the schedule.
    console.error('[deleteTemplate]', error.message);
    const { error: deactivateError } = await supabase
      .from('class_templates')
      .update({ is_active: false })
      .eq('id', id);
    if (deactivateError) return DELETE_FAILED;
  }

  revalidateSchedule();
  return { ok: true, keptWithBookings };
}

// ─── Single sessions (the calendar) ──────────────────────────────────────────

export async function toggleClassActive(id: string): Promise<ActionResult> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const supabase = createServiceRoleClient();
  const { data: current, error: fetchError } = await supabase
    .from('classes')
    .select('is_active')
    .eq('id', id)
    .single();
  if (fetchError) return SAVE_FAILED;

  const { error } = await supabase
    .from('classes')
    .update({ is_active: !current.is_active })
    .eq('id', id);
  if (error) {
    console.error('[toggleClassActive]', error.message);
    return SAVE_FAILED;
  }
  revalidateSchedule();
  return { ok: true };
}

export async function updateClassDetails(id: string, data: ClassUpdate): Promise<ActionResult> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('classes').update(data).eq('id', id);
  if (error) {
    console.error('[updateClassDetails]', error.message);
    return SAVE_FAILED;
  }
  revalidateSchedule();
  return { ok: true };
}

/**
 * Takes one session off the schedule. Its bookings are kept; the session is
 * switched off rather than removed so they still have a class to point at.
 */
export async function deleteClass(id: string): Promise<ActionResult> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('classes').update({ is_active: false }).eq('id', id);
  if (error) {
    console.error('[deleteClass]', error.message);
    return DELETE_FAILED;
  }
  revalidateSchedule();
  return { ok: true };
}

// A dated, one-off `classes` row (not a recurring template). Used by the
// calendar's tap-to-create and the drawer's Edit action.
// (ClassInstancePayload lives in @/types — 'use server' files may only export
// async functions, so the shared type can't be declared here.)

export async function createClassInstance(payload: ClassInstancePayload): Promise<ActionResult> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const supabase = createServiceRoleClient();
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
  if (error) {
    console.error('[createClassInstance]', error.message);
    return SAVE_FAILED;
  }
  revalidateSchedule();
  return { ok: true };
}

export async function updateClassInstance(
  id: string,
  payload: ClassInstancePayload,
): Promise<ActionResult> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const supabase = createServiceRoleClient();

  // Preserve existing bookings when capacity changes: keep `occupied` fixed and
  // recompute remaining spots against the new capacity.
  const { data: current } = await supabase
    .from('classes')
    .select('capacity, spots_remaining, starts_at, template_id')
    .eq('id', id)
    .single();

  const occupied = current ? Math.max(0, current.capacity - current.spots_remaining) : 0;
  const spotsRemaining = Math.max(0, payload.capacity - occupied);

  // A session moved to another day or time is no longer the recurring class's
  // session for that week but a one-off: the recurring slot gets its own
  // session again at the next materialization, and this one is left alone.
  const moved =
    !!current?.template_id &&
    new Date(current.starts_at).getTime() !== new Date(payload.starts_at).getTime();

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
      ...(moved ? { template_id: null } : {}),
    })
    .eq('id', id);
  if (error) {
    console.error('[updateClassInstance]', error.message);
    return SAVE_FAILED;
  }
  revalidateSchedule();
  return { ok: true };
}
