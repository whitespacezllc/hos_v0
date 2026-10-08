import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import InstructorDashboard from './_components/InstructorDashboard';
import type { DbClass } from '@/types';
import { dbClassToYogaClass } from '@/types';
import { CLASS_WITH_INSTRUCTOR } from '@/lib/queries/classes';

type InstructorRow = { id: string; name: string; email: string };

export default async function InstructorPage() {
  const supabase      = await createClient();
  const serviceClient = await createServiceClient();

  // Usuario actual
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Instructor record — casting hasta aplicar migración 002
  const { data: instructor } = await (serviceClient as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: InstructorRow | null }>;
        };
      };
    };
  }).from('instructors').select('id, name, email').eq('email', user.email ?? '').single();

  if (!instructor) {
    return (
      <div className="p-8 text-center text-slate-500">
        No se encontró tu perfil de instructor. Contactá al administrador.
      </div>
    );
  }

  // Clases del instructor (todas, incluyendo pasadas)
  const { data: rawClasses } = await serviceClient
    .from('classes')
    .select(CLASS_WITH_INSTRUCTOR)
    .eq('instructor_id', instructor.id)
    .order('starts_at', { ascending: false })
    .limit(50);

  const classes = (rawClasses as unknown as DbClass[] ?? []).map(dbClassToYogaClass);

  // Bookings de las clases del instructor
  const classIds = classes.map(c => c.id);
  const { data: bookingsRaw } = classIds.length > 0
    ? await serviceClient
        .from('bookings')
        .select('*')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  const bookings = bookingsRaw ?? [];

  return (
    <InstructorDashboard
      instructor={instructor}
      classes={classes.map(c => ({ ...c, startsAt: c.startsAt.toISOString() }))}
      bookings={bookings as unknown as Parameters<typeof InstructorDashboard>[0]['bookings']}
    />
  );
}
