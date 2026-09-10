'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import type { Database } from '@/types/supabase';
import type { ClassInstancePayload } from '@/types';
import { requireAdmin } from '@/lib/auth/require-admin';
import { costaRicaDateString, costaRicaWeekStart } from '@/lib/costa-rica-time';

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

export async function updateTemplate(id: string, data: TemplateUpdate) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('class_templates').update(data).eq('id', id);
  if (error) throw new Error(error.message);

  // Propagate an image change to this template's upcoming (not-yet-past)
  // sessions so the new picture shows on the booking page right away — not only
  // on sessions materialized in the future.
  if ('image_url' in data) {
    await supabase
      .from('classes')
      .update({ image_url: data.image_url ?? null })
      .eq('template_id', id)
      .gte('starts_at', new Date().toISOString());
  }

  revalidatePath('/admin/clases');
  revalidatePath('/admin/calendario');
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
