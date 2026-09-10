import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import type { DbClass, YogaClass } from '@/types';
import { dbClassToYogaClass } from '@/types';
import { costaRicaDateString, costaRicaWeekStart, toInstantIso } from '@/lib/costa-rica-time';

const CLASS_WITH_INSTRUCTOR = `
  *,
  instructors (
    id,
    name
  )
` as const;

// How many weeks ahead we auto-materialize occurrences for. Prevents unbounded
// row creation from paging far into the future.
const MAX_WEEKS_AHEAD = 16;

// The Monday of the Costa Rica week containing `d`, as a `YYYY-MM-DD` string.
// `generate_week_classes` builds each class at `<date> <HH:MM>-06`, so the week
// it fills must be a Costa Rica week — not the server's, which on Vercel is UTC
// and already on Monday while Santa Teresa is still having Sunday dinner.
function mondayOf(d: Date): string {
  return costaRicaDateString(costaRicaWeekStart(d));
}

// Materializes the recurring class_templates into concrete `classes` rows for the
// week containing `weekStart` (idempotent — the RPC only inserts what's missing).
// This replaces the former manual "Generate week" admin action: the calendar
// fills itself from the recurring schedule whenever a week is viewed.
export async function ensureWeekMaterialized(weekStart: Date): Promise<void> {
  const monday = mondayOf(weekStart);

  // Skip past weeks (nothing bookable) and weeks beyond the cap.
  const currentMonday = new Date(`${mondayOf(new Date())}T00:00:00-06:00`).getTime();
  const targetMonday = new Date(`${monday}T00:00:00-06:00`).getTime();
  const weeksAhead = Math.round((targetMonday - currentMonday) / (7 * 24 * 60 * 60 * 1000));
  if (weeksAhead < 0 || weeksAhead > MAX_WEEKS_AHEAD) return;

  try {
    // Session-less on purpose: under an admin's cookie the cookie-bound client
    // would run the RPC as that user, and the function is the service's to call.
    const service = createServiceRoleClient();
    await service.rpc('generate_week_classes', { p_week_start: monday });
  } catch (err) {
    // Non-fatal: fall through and let callers read whatever already exists.
    console.error('[ensureWeekMaterialized]', err);
  }
}

export async function getActiveClasses(): Promise<YogaClass[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('classes')
      .select(CLASS_WITH_INSTRUCTOR)
      .eq('is_active', true)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true });

    if (error) {
      console.error('[getActiveClasses]', error.message);
      return [];
    }
    return (data as unknown as DbClass[]).map(dbClassToYogaClass);
  } catch (err) {
    console.error('[getActiveClasses] unexpected:', err);
    return [];
  }
}

export async function getClassById(id: string): Promise<DbClass | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('classes')
      .select(CLASS_WITH_INSTRUCTOR)
      .eq('id', id)
      .single();

    if (error) {
      console.error('[getClassById]', error.message);
      return null;
    }
    return data as unknown as DbClass;
  } catch (err) {
    console.error('[getClassById] unexpected:', err);
    return null;
  }
}

export async function getClassesForWeek(
  weekStart: Date,
  weekEnd: Date,
): Promise<YogaClass[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('classes')
      .select(CLASS_WITH_INSTRUCTOR)
      .eq('is_active', true)
      .gte('starts_at', toInstantIso(weekStart))
      .lte('starts_at', toInstantIso(weekEnd))
      .order('starts_at', { ascending: true });

    if (error) {
      console.error('[getClassesForWeek]', error.message);
      return [];
    }
    return (data as unknown as DbClass[]).map(dbClassToYogaClass);
  } catch (err) {
    console.error('[getClassesForWeek] unexpected:', err);
    return [];
  }
}

export async function getClassTemplates() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('class_templates')
      .select('*, instructors(id, name)')
      .order('day_of_week', { ascending: true });

    if (error) {
      console.error('[getClassTemplates]', error.message);
      return [];
    }
    return data;
  } catch (err) {
    console.error('[getClassTemplates] unexpected:', err);
    return [];
  }
}

// Admin-facing shape for a recurring schedule row.
export type AdminTemplate = {
  id: string;
  name: string;
  description: string | null;
  instructorId: string | null;
  instructorName: string;
  dayOfWeek: number;
  timeStart: string;
  durationMinutes: number;
  capacity: number;
  location: string;
  isActive: boolean;
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  instructor_id: string | null;
  day_of_week: number;
  time_start: string;
  duration_minutes: number;
  capacity: number;
  location: string;
  is_active: boolean;
  instructors: { id: string; name: string } | null;
};

// Returns ALL templates (including inactive) for the admin schedule manager.
export async function getAllTemplatesAdmin(): Promise<AdminTemplate[]> {
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('class_templates')
      .select('*, instructors(id, name)')
      .order('day_of_week', { ascending: true })
      .order('time_start', { ascending: true });

    if (error) {
      console.error('[getAllTemplatesAdmin]', error.message);
      return [];
    }
    return (data as unknown as TemplateRow[]).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      instructorId: t.instructor_id,
      instructorName: t.instructors?.name ?? '',
      dayOfWeek: t.day_of_week,
      timeStart: t.time_start?.slice(0, 5) ?? '',
      durationMinutes: t.duration_minutes,
      capacity: t.capacity,
      location: t.location,
      isActive: t.is_active,
    }));
  } catch (err) {
    console.error('[getAllTemplatesAdmin] unexpected:', err);
    return [];
  }
}

export async function getInstructors(): Promise<{ id: string; name: string }[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('instructors')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error('[getInstructors]', error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('[getInstructors] unexpected:', err);
    return [];
  }
}

export async function getAllClasses(): Promise<YogaClass[]> {
  try {
    // Usar serviceClient para saltear RLS y ver clases inactivas también en el admin
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('classes')
      .select(CLASS_WITH_INSTRUCTOR)
      .order('starts_at', { ascending: true });

    if (error) {
      console.error('[getAllClasses]', error.message);
      return [];
    }
    return (data as unknown as DbClass[]).map(dbClassToYogaClass);
  } catch (err) {
    console.error('[getAllClasses] unexpected:', err);
    return [];
  }
}
