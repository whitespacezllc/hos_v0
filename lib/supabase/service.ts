import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// ─── Service-role client, no session attached ───────────────────────────────
// The cookie-bound createServiceClient() in ./server.ts is handed the service
// key, but supabase-js sends the signed-in user's own access token on every
// request once a session exists — the key only fills in when there is none.
// So from inside the admin panel that client acts as the admin under RLS,
// which the table policies allow (is_admin) and Storage does not: a bucket
// with no write policy refuses the upload with "new row violates row-level
// security policy".
//
// This client carries the service key itself, bypasses RLS, and is used only
// behind an explicit admin check in the action that calls it.
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
