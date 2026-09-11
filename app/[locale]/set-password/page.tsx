import { setRequestLocale } from 'next-intl/server';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import SetPasswordClient from './SetPasswordClient';

// ─── Set a password ──────────────────────────────────────────────────────────
// Where the email links land. The token exchange and the form are
// SetPasswordClient; this shell fixes the language from the URL and hands
// the `auth` catalogue to the client.

export default async function SetPasswordPage({ params }: LocaleParams) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);

  return (
    <PageMessages namespaces={['auth']}>
      <SetPasswordClient />
    </PageMessages>
  );
}
