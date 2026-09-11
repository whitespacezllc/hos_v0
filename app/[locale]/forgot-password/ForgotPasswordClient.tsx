'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { describeResetError, type AuthErrorKey } from '@/lib/auth/errors';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell, AuthError, FIELD_INPUT, FIELD_LABEL, SUBMIT_BUTTON } from '@/components/auth/AuthShell';

// ─── Forgot your password ────────────────────────────────────────────────────
// Asks Supabase to email a one-time link that lands on /set-password. The
// answer on screen is the same whether or not the address has an account:
// the form is not a way to find out which emails are admins. The email
// itself is the "Reset Password" template in Supabase (supabase/templates/
// recovery.html), and the link it carries is verified on /set-password on
// whatever device opens it.

type Phase = 'idle' | 'sending' | 'sent';

export default function ForgotPasswordClient() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<AuthErrorKey | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase('sending');
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (resetError) {
        setError(describeResetError(resetError));
        setPhase('idle');
        return;
      }
      setPhase('sent');
    } catch {
      setError('resetFailed');
      setPhase('idle');
    }
  }

  const backToSignIn = (
    <Link href="/login" className="font-body text-sm text-ink/60 hover:text-ink underline underline-offset-4 decoration-[0.5px]">
      {t('forgot.backToSignIn')}
    </Link>
  );

  return (
    <AuthShell title={t('forgot.title')} subtitle={t('forgot.subtitle')}>
      {phase === 'sent' ? (
        <div className="space-y-5" role="status">
          <p className="font-body text-sm text-ink leading-relaxed">
            {t.rich('forgot.sentBody', {
              email: email.trim(),
              strong: (chunks) => <strong className="font-medium">{chunks}</strong>,
            })}
          </p>
          <p className="font-body text-xs text-ink/60 leading-relaxed">{t('forgot.sentHint')}</p>
          <div className="text-center pt-1">{backToSignIn}</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className={FIELD_LABEL}>
              {t('forgot.email')}
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
              placeholder={t('forgot.emailPlaceholder')}
              aria-invalid={error ? true : undefined}
              className={FIELD_INPUT}
            />
          </div>

          {error && <AuthError>{t(`errors.${error}`)}</AuthError>}

          <Button type="submit" className={SUBMIT_BUTTON} disabled={phase === 'sending'} aria-busy={phase === 'sending'}>
            {phase === 'sending' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />
                {t('forgot.sending')}
              </>
            ) : (
              t('forgot.submit')
            )}
          </Button>

          <div className="text-center pt-1">{backToSignIn}</div>
        </form>
      )}
    </AuthShell>
  );
}
