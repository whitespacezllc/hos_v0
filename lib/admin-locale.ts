import { cookies } from 'next/headers';
import { hasLocale } from 'next-intl';
import { routing, type AppLocale } from '@/i18n/routing';

// ─── The admin panel's language ──────────────────────────────────────────────
// The public site takes its language from the URL (`/es/yoga`). The admin
// lives outside that segment — there is one `/admin`, not an `/es/admin` — so
// its language is a preference, kept in a cookie the sidebar toggle writes.
// English until someone chooses otherwise, which is what the panel always was.
//
// Read on the server (layouts, next-intl's request config); written by the
// `setAdminLocale` action; also set at sign-in to the language of the login
// page, so an admin who signed in on /es/login lands in a Spanish panel.

export const ADMIN_LOCALE_COOKIE = 'hos_admin_locale';

/** A year: the choice is a preference, not a session. */
export const ADMIN_LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

export function asAdminLocale(value: unknown): AppLocale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

/** The admin's chosen language, from the cookie; English when unset. */
export async function readAdminLocale(): Promise<AppLocale> {
  const store = await cookies();
  return asAdminLocale(store.get(ADMIN_LOCALE_COOKIE)?.value);
}
