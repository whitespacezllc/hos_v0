import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import InstructorLayout from '@/components/instructor/InstructorLayout';
import { isInstructor } from '@/lib/auth/roles';
import { BackofficeDocument, BACKOFFICE_METADATA } from '@/components/backoffice/BackofficeDocument';

export const metadata: Metadata = {
  ...BACKOFFICE_METADATA,
  title: 'Portal Instructor — House of Shakti',
};

// Tipo extendido hasta que la migración actualice los tipos generados
type InstructorRow = { id: string; name: string; email: string };

export default async function InstructorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verificar sesión activa
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Si no hay sesión, redirigir al login
  if (!user) {
    redirect('/instructor/login');
  }

  // Verificar que el usuario tiene rol instructor (app_metadata — ver lib/auth/roles.ts)
  if (!isInstructor(user)) {
    redirect('/instructor/login');
  }

  // Buscar datos del instructor en la tabla instructors por email
  // Casting necesario hasta aplicar migración 002 que agrega la columna email
  const serviceClient = await createServiceClient();
  const { data: instructor } = await (serviceClient as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: InstructorRow | null }>;
        };
      };
    };
  }).from('instructors').select('id, name, email').eq('email', user.email ?? '').single();

  // A root layout (see BackofficeDocument): the portal lives outside the
  // public site's locale segment.
  return (
    <BackofficeDocument>
      <InstructorLayout
        instructorName={instructor?.name ?? user.user_metadata?.full_name ?? 'Instructor'}
        instructorEmail={instructor?.email ?? user.email ?? ''}
      >
        {children}
      </InstructorLayout>
    </BackofficeDocument>
  );
}
