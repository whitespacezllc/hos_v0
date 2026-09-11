'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { homeFor } from '@/lib/auth/roles';
import { describeUpdatePasswordError, type AuthErrorKey } from '@/lib/auth/errors';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AuthShell, AuthError, FIELD_LABEL, SUBMIT_BUTTON } from '@/components/auth/AuthShell';
import { PasswordInput } from '@/components/auth/PasswordInput';

// ─── Set a password ──────────────────────────────────────────────────────────
// Where the email links land: an invitation ("set your password") and a
// reset ("choose a new one") both come here with a one-time token, which is
// exchanged for a session before the person types anything. Three ways the
// token can arrive, in the order they are tried:
//
//   1. A session already in the browser — the client picked up tokens from
//      the URL hash (Supabase's default templates), or the person is simply
//      signed in and wants a new password.
//   2. `token_hash` + `type` in the query — our own templates
//      (supabase/templates/*.html) and scripts/invite-admins.mjs build links
//      this way. Verified on the server, so the link opens on any device.
//   3. A PKCE `code` — only works in the browser that asked for the link.
//
// A link that has expired or was already used comes back from Supabase
// with `error` parameters; those get their own screen and a way to ask for
// a fresh link. Setting a password never grants a role: the account keeps
// whatever app_metadata says (lib/auth/roles.ts), and is sent to its own
// door — or signed out, if it has none.

const MIN_LENGTH = 10;

type Phase = 'verifying' | 'ready' | 'saving' | 'expired' | 'no-access';

type Landing = { kind: 'invite' | 'recovery' | 'signed-in'; error?: string };

// What went wrong with the form: a check made here (length, match) or an
// answer from Supabase. Kept as keys and translated at render.
type Problem = { kind: 'local'; key: 'tooShort' | 'mismatch' } | { kind: 'server'; key: AuthErrorKey };

function readLanding(): Landing & { tokenHash?: string; type?: string; code?: string } {
  const url = new URL(window.location.href);
  // Supabase reports a bad link in the query on our templates and in the
  // hash on its own; read both.
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const read = (key: string) => url.searchParams.get(key) ?? hash.get(key);
  const type = read('type') ?? undefined;
  const errorCode = read('error_code') ?? read('error') ?? undefined;
  return {
    kind: type === 'invite' ? 'invite' : type === 'recovery' ? 'recovery' : 'signed-in',
    error: errorCode ?? undefined,
    tokenHash: read('token_hash') ?? undefined,
    type,
    code: url.searchParams.get('code') ?? undefined,
  };
}

export default function SetPasswordClient() {
  const t = useTranslations('auth');
  const [supabase] = useState(() => createClient());
  const [phase, setPhase] = useState<Phase>('verifying');
  const [landing, setLanding] = useState<Landing>({ kind: 'signed-in' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);

  const errorText = problem
    ? problem.kind === 'local'
      ? t(`setPassword.${problem.key}`, { min: MIN_LENGTH })
      : t(`errors.${problem.key}`)
    : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const l = readLanding();
      if (!cancelled) setLanding({ kind: l.kind, error: l.error });

      if (l.error) {
        if (!cancelled) setPhase('expired');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        if (!cancelled) setPhase('ready');
        return;
      }

      if (l.tokenHash && l.type) {
        const { error: vErr } = await supabase.auth.verifyOtp({
          type: l.type as EmailOtpType,
          token_hash: l.tokenHash,
        });
        if (!cancelled && !vErr) {
          setPhase('ready');
          return;
        }
      }

      if (l.code) {
        const { error: cErr } = await supabase.auth.exchangeCodeForSession(l.code);
        if (!cancelled && !cErr) {
          setPhase('ready');
          return;
        }
      }

      if (!cancelled) setPhase('expired');
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);

    if (password.length < MIN_LENGTH) {
      setProblem({ kind: 'local', key: 'tooShort' });
      return;
    }
    if (password !== confirm) {
      setProblem({ kind: 'local', key: 'mismatch' });
      return;
    }

    setPhase('saving');
    const { data, error: uErr } = await supabase.auth.updateUser({ password });
    if (uErr) {
      setProblem({ kind: 'server', key: describeUpdatePasswordError(uErr) });
      setPhase('ready');
      return;
    }

    // Hard navigation so the proxy re-evaluates the fresh session and role.
    const home = homeFor(data.user);
    if (home) {
      window.location.assign(home);
      return;
    }
    await supabase.auth.signOut();
    setPhase('no-access');
  }

  const title = t('setPassword.title', { kind: landing.kind });
  const subtitle = t('setPassword.subtitle', { kind: landing.kind });

  const backToSignIn = (
    <Link href="/login" className="font-body text-sm text-ink/60 hover:text-ink underline underline-offset-4 decoration-[0.5px]">
      {t('setPassword.backToSignIn')}
    </Link>
  );

  return (
    <AuthShell title={title} subtitle={subtitle}>
      {phase === 'verifying' ? (
        <div className="flex flex-col items-center gap-3 py-6 text-ink/50" role="status">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          <p className="font-body text-sm">{t('setPassword.checking')}</p>
        </div>
      ) : phase === 'expired' ? (
        <div className="space-y-5">
          <AuthError>{t('setPassword.expired')}</AuthError>
          <Link
            href="/forgot-password"
            className="block w-full h-10 leading-10 text-center bg-burgundy text-cream font-body text-sm hover:bg-dark transition-colors"
          >
            {t('setPassword.newLink')}
          </Link>
          <div className="text-center">{backToSignIn}</div>
        </div>
      ) : phase === 'no-access' ? (
        <div className="space-y-5" role="status">
          <p className="font-body text-sm text-ink leading-relaxed">{t('setPassword.noAccess')}</p>
          <div className="text-center">{backToSignIn}</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className={FIELD_LABEL}>
              {t('setPassword.newPassword')}
            </Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              autoFocus
              required
              minLength={MIN_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('setPassword.passwordPlaceholder', { min: MIN_LENGTH })}
              aria-invalid={errorText ? true : undefined}
            />
            <p className="font-body text-xs text-ink/50">{t('setPassword.hint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm" className={FIELD_LABEL}>
              {t('setPassword.confirmPassword')}
            </Label>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              required
              minLength={MIN_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('setPassword.confirmPlaceholder')}
              aria-invalid={errorText ? true : undefined}
            />
          </div>

          {errorText && <AuthError>{errorText}</AuthError>}

          <Button type="submit" className={SUBMIT_BUTTON} disabled={phase === 'saving'} aria-busy={phase === 'saving'}>
            {phase === 'saving' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />
                {t('setPassword.saving')}
              </>
            ) : (
              t('setPassword.submit')
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
