import { setRequestLocale } from 'next-intl/server';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import ForgotPasswordClient from './ForgotPasswordClient';

// ─── Forgot your password ────────────────────────────────────────────────────
// The form is ForgotPasswordClient; this shell fixes the language from the
// URL and hands the `auth` catalogue to the client.

export default async function ForgotPasswordPage({ params }: LocaleParams) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);

  return (
    <PageMessages namespaces={['auth']}>
      <ForgotPasswordClient />
    </PageMessages>
  );
}
