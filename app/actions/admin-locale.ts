'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ADMIN_LOCALE_COOKIE, ADMIN_LOCALE_MAX_AGE, asAdminLocale } from '@/lib/admin-locale';
import type { AppLocale } from '@/i18n/routing';

// Remembers the language the admin panel should speak. No admin check on
// purpose: the cookie only chooses between the two languages the site already
// has, and the sign-in page sets it before there is a session.
export async function setAdminLocale(locale: AppLocale): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_LOCALE_COOKIE, asAdminLocale(locale), {
    path: '/',
    maxAge: ADMIN_LOCALE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  });
  revalidatePath('/admin', 'layout');
}
