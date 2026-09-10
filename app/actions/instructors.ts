'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type InstructorInsert = Database['public']['Tables']['instructors']['Insert'];
type InstructorUpdate = Database['public']['Tables']['instructors']['Update'];

export type InstructorActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath('/admin/clases');
  revalidatePath('/admin');
  revalidatePath('/admin/calendario');
}

export async function createInstructor(
  data: InstructorInsert,
): Promise<InstructorActionResult> {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('instructors').insert(data);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateInstructor(
  id: string,
  data: InstructorUpdate,
): Promise<InstructorActionResult> {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('instructors').update(data).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteInstructor(
  id: string,
): Promise<InstructorActionResult> {
  await requireAdmin();
  const supabase = await createServiceClient();

  // Los FK instructor_id (class_templates / classes) no tienen ON DELETE CASCADE,
  // así que bloqueamos el delete si el instructor está en uso y devolvemos un
  // mensaje claro en vez de un error crudo de Postgres.
  const [{ count: templateCount }, { count: classCount }] = await Promise.all([
    supabase
      .from('class_templates')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_id', id),
    supabase
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_id', id),
  ]);

  if ((templateCount ?? 0) > 0 || (classCount ?? 0) > 0) {
    return {
      ok: false,
      error:
        'This instructor is assigned to classes. Reassign or remove those classes first.',
    };
  }

  const { error } = await supabase.from('instructors').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
