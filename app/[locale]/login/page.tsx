import { setRequestLocale } from 'next-intl/server';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import LoginClient from './LoginClient';

// ─── Sign in ─────────────────────────────────────────────────────────────────
// The panel's front door. The form itself is LoginClient; this shell fixes
// the language from the URL (/login, /es/login) and hands the `auth`
// catalogue to the client, the way every page under app/[locale] does.

export default async function AdminLoginPage({ params }: LocaleParams) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);

  return (
    <PageMessages namespaces={['auth']}>
      <LoginClient />
    </PageMessages>
  );
}
