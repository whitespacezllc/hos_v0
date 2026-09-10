import type { AuthError } from '@supabase/supabase-js';

// ─── What to tell a person when auth says no ─────────────────────────────────
// Supabase's messages are written for developers ("Invalid login
// credentials", "over_email_send_rate_limit"). These are the sentences a
// person at the door reads instead — specific where it helps them, and never
// more specific than is safe: a wrong password and an unknown email get the
// same line, so the form can't be used to learn which emails have accounts.

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

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

export function describeSignInError(error: AuthError): string {
  if (isRateLimited(error)) return 'Too many attempts. Wait a minute and try again.';
  if (looksLike(error, 'email not confirmed', 'email_not_confirmed')) {
    return 'This email hasn’t been confirmed yet. Use “Forgot your password?” to get a link and set your password.';
  }
  if (isOffline(error)) return 'Couldn’t reach the server. Check your connection and try again.';
  if (looksLike(error, 'invalid login credentials', 'invalid_credentials') || error.status === 400) {
    return 'Incorrect email or password.';
  }
  return GENERIC_ERROR;
}

export function describeResetError(error: AuthError): string {
  if (isRateLimited(error)) return 'Too many requests. Wait a minute and try again.';
  if (isOffline(error)) return 'Couldn’t reach the server. Check your connection and try again.';
  if (looksLike(error, 'invalid email', 'validation_failed')) return 'That doesn’t look like an email address.';
  return 'The email couldn’t be sent right now. Please try again in a moment.';
}

export function describeUpdatePasswordError(error: AuthError): string {
  if (isRateLimited(error)) return 'Too many attempts. Wait a minute and try again.';
  if (looksLike(error, 'same password', 'same_password')) return 'Choose a password you haven’t used here before.';
  if (looksLike(error, 'weak', 'password should', 'password_length', 'weak_password')) {
    return 'That password is too weak — use at least 10 characters, mixing letters, numbers and symbols.';
  }
  if (looksLike(error, 'session', 'not authenticated', 'jwt', 'expired')) {
    return 'This link has expired or was already used. Ask for a new one from the sign-in page.';
  }
  return 'Couldn’t save the password. Please try again.';
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
