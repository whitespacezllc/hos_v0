'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/auth/roles';
import { GENERIC_ERROR, describeSignInError, safeAdminPath, type AuthErrorKey } from '@/lib/auth/errors';
import { setAdminLocale } from '@/app/actions/admin-locale';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell, AuthError, FIELD_INPUT, FIELD_LABEL, SUBMIT_BUTTON } from '@/components/auth/AuthShell';
import { PasswordInput } from '@/components/auth/PasswordInput';

// ─── Sign in ─────────────────────────────────────────────────────────────────
// The panel's front door. Email and password against Supabase Auth; the
// account has to carry the admin role (lib/auth/roles.ts) or it is signed
// straight back out — an instructor's password opens the portal, not this.
//
// The proxy sends anyone who reaches /admin/* without a session here with
// `?redirect=` set to where they were going, and the form takes them back
// there once they are in — but only inside the panel (safeAdminPath), never
// to an address someone else put in a link.
//
// The panel lives outside the locale segment, so the language of this page
// (/login vs /es/login) is remembered for it at sign-in (setAdminLocale):
// an admin who signed in in Spanish gets a Spanish panel.

type Problem = { key: AuthErrorKey } | { key: 'noAccess' };

function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale() as AppLocale;
  // Next's router, not next-intl's: the destination is the panel, which has
  // no locale prefix.
  const router = useRouter();
  const params = useSearchParams();
  const destination = safeAdminPath(params.get('redirect'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const errorText = problem ? (problem.key === 'noAccess' ? t('login.noAccess') : t(`errors.${problem.key}`)) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setProblem(null);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setProblem({ key: describeSignInError(authError) });
        return;
      }

      if (!isAdmin(data.user)) {
        await supabase.auth.signOut();
        setProblem({ key: 'noAccess' });
        return;
      }

      await setAdminLocale(locale);
      router.replace(destination);
      router.refresh();
    } catch {
      setProblem({ key: GENERIC_ERROR });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className={FIELD_LABEL}>
          {t('login.email')}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('login.emailPlaceholder')}
          aria-invalid={errorText ? true : undefined}
          className={FIELD_INPUT}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password" className={FIELD_LABEL}>
            {t('login.password')}
          </Label>
          <Link
            href="/forgot-password"
            className="font-body text-xs text-ink/60 hover:text-ink underline underline-offset-4 decoration-[0.5px]"
          >
            {t('login.forgot')}
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••"
          aria-invalid={errorText ? true : undefined}
        />
      </div>

      {errorText && <AuthError>{errorText}</AuthError>}

      <Button type="submit" className={SUBMIT_BUTTON} disabled={loading} aria-busy={loading}>
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />
            {t('login.signingIn')}
          </>
        ) : (
          t('login.signIn')
        )}
      </Button>
    </form>
  );
}

export default function LoginClient() {
  const t = useTranslations('auth.login');
  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')}>
      {/* useSearchParams needs a boundary: the page is prerendered and the
          query is only known in the browser. */}
      <Suspense fallback={<div className="h-[212px]" aria-hidden />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
