import type { AuthError } from '@supabase/supabase-js';

// ─── What to tell a person when auth says no ─────────────────────────────────
// Supabase's messages are written for developers ("Invalid login
// credentials", "over_email_send_rate_limit"). These functions pick the
// sentence a person at the door reads instead — specific where it helps
// them, and never more specific than is safe: a wrong password and an
// unknown email get the same line, so the form can't be used to learn which
// emails have accounts.
//
// They return a KEY of the `auth.errors` namespace (messages/{en,es}.json),
// not a sentence: the pages render it through next-intl in the language of
// the URL (`t(`errors.${key}`)`), so the same decision reads in English on
// /login and in Spanish on /es/login.

export type AuthErrorKey =
  | 'generic'
  | 'tooManyAttempts'
  | 'tooManyRequests'
  | 'emailNotConfirmed'
  | 'offline'
  | 'invalidCredentials'
  | 'invalidEmail'
  | 'resetFailed'
  | 'samePassword'
  | 'weakPassword'
  | 'linkExpired'
  | 'updateFailed';

function looksLike(error: AuthError, ...needles: string[]): boolean {
  const haystack = `${error.message} ${error.code ?? ''}`.toLowerCase();
  return needles.some((n) => haystack.includes(n));
}

function isRateLimited(error: AuthError): boolean {
  return error.status === 429 || looksLike(error, 'rate limit', 'too many', 'rate_limit');
}

function isOffline(error: AuthError): boolean {
  return looksLike(error, 'fetch', 'network', 'failed to fetch');
}

/** The line for anything unexpected ("Something went wrong. Please try again."). */
export const GENERIC_ERROR: AuthErrorKey = 'generic';

export function describeSignInError(error: AuthError): AuthErrorKey {
  if (isRateLimited(error)) return 'tooManyAttempts';
  if (looksLike(error, 'email not confirmed', 'email_not_confirmed')) return 'emailNotConfirmed';
  if (isOffline(error)) return 'offline';
  if (looksLike(error, 'invalid login credentials', 'invalid_credentials') || error.status === 400) {
    return 'invalidCredentials';
  }
  return GENERIC_ERROR;
}

export function describeResetError(error: AuthError): AuthErrorKey {
  if (isRateLimited(error)) return 'tooManyRequests';
  if (isOffline(error)) return 'offline';
  if (looksLike(error, 'invalid email', 'validation_failed')) return 'invalidEmail';
  return 'resetFailed';
}

export function describeUpdatePasswordError(error: AuthError): AuthErrorKey {
  if (isRateLimited(error)) return 'tooManyAttempts';
  if (looksLike(error, 'same password', 'same_password')) return 'samePassword';
  if (looksLike(error, 'weak', 'password should', 'password_length', 'weak_password')) return 'weakPassword';
  if (looksLike(error, 'session', 'not authenticated', 'jwt', 'expired')) return 'linkExpired';
  return 'updateFailed';
}

/**
 * Only a path inside the panel is a place the sign-in page will send someone
 * after they sign in. Anything else — another site, a protocol-relative URL,
 * the public site — falls back to the panel's front door, so the `redirect`
 * parameter can't be used to bounce a person somewhere they didn't choose.
 */
export function safeAdminPath(raw: string | null | undefined): string {
  if (!raw) return '/admin';
  if (!raw.startsWith('/admin') || raw.startsWith('//') || raw.includes('://') || raw.includes('\\')) return '/admin';
  return raw;
}
