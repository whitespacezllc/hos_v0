import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import DashboardLayout from '@/components/admin/DashboardLayout';
import { BackofficeDocument, BACKOFFICE_METADATA } from '@/components/backoffice/BackofficeDocument';
import { pickMessages } from '@/i18n/messages';
import { readAdminLocale } from '@/lib/admin-locale';
import { getAdminPendingCounts } from '@/lib/queries/adminCounts';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  ...BACKOFFICE_METADATA,
  title: 'Admin — House of Shakti',
};

// Not cached: badge counts should reflect the latest pending items on each load.
export const dynamic = 'force-dynamic';

// A root layout (see BackofficeDocument): the admin lives outside the public
// site's locale segment. Its language is the admin's own choice (a cookie,
// lib/admin-locale.ts); the request config already resolved it, so
// `getMessages` returns that language's catalogue, and the client components
// below get the `admin` namespace of it through the provider.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The proxy has already let only an admin this far; this is just who.
  const supabase = await createClient();
  const [pendingCounts, { data: { user } }, locale, messages] = await Promise.all([
    getAdminPendingCounts(),
    supabase.auth.getUser(),
    readAdminLocale(),
    getMessages(),
  ]);
  return (
    <BackofficeDocument lang={locale}>
      <NextIntlClientProvider locale={locale} messages={pickMessages(messages, ['admin'])}>
        <DashboardLayout pendingCounts={pendingCounts} adminEmail={user?.email}>
          {children}
        </DashboardLayout>
      </NextIntlClientProvider>
    </BackofficeDocument>
  );
}
