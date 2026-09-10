import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth/roles';

// The proxy already turns away anyone without an admin session before a
// request reaches /admin/*, but a server action is its own endpoint and can
// be called from anywhere. Every admin action repeats the check here, at the
// action itself, so a stray call meets the same door as the page.
export async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user)) throw new Error('You need to be signed in as an admin.');
}

/** The same check, as a boolean, for actions that answer with a result object. */
export async function isAdminSession(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isAdmin(user);
}
