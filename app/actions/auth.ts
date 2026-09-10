'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// ─── Sign out ────────────────────────────────────────────────────────────────
// Server-side, so the session cookies are cleared by the same client that
// set them, and the next request — the redirect to /login — already arrives
// without a session. The proxy would otherwise still see the old cookies for
// one round trip.
export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
