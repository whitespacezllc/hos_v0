import type { Metadata } from 'next';
import DashboardLayout from '@/components/admin/DashboardLayout';
import { BackofficeDocument, BACKOFFICE_METADATA } from '@/components/backoffice/BackofficeDocument';
import { getAdminPendingCounts } from '@/lib/queries/adminCounts';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  ...BACKOFFICE_METADATA,
  title: 'Admin — House of Shakti',
};

// Not cached: badge counts should reflect the latest pending items on each load.
export const dynamic = 'force-dynamic';

// A root layout (see BackofficeDocument): the admin lives outside the public
// site's locale segment.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The proxy has already let only an admin this far; this is just who.
  const supabase = await createClient();
  const [pendingCounts, { data: { user } }] = await Promise.all([getAdminPendingCounts(), supabase.auth.getUser()]);
  return (
    <BackofficeDocument>
      <DashboardLayout pendingCounts={pendingCounts} adminEmail={user?.email}>
        {children}
      </DashboardLayout>
    </BackofficeDocument>
  );
}
