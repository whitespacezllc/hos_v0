-- ─────────────────────────────────────────────────────────────────────────────
-- 008 · Roles move to app_metadata
--
-- Until now an account was an admin (or an instructor) because its
-- `user_metadata` said so. `user_metadata` is the user's own: any signed-in
-- account can rewrite it with the public key — `supabase.auth.updateUser({
-- data: { role: 'admin' } })` from a browser console — and an instructor
-- account could have let itself into the panel. `app_metadata` can only be
-- written with the service key (the admin API, the scripts in /scripts, this
-- editor), which is what a role needs.
--
-- Three moves, all safe to run again:
--   1. is_admin() / is_instructor() read app_metadata.
--   2. Every account that carried a role in user_metadata gets it in
--      app_metadata (only if it isn't already there).
--   3. The user_metadata copy is removed, so nothing can be misled by it.
--
-- The app reads the same claim from here on (lib/auth/roles.ts). A session
-- signed in before this ran carries a token without the claim until it
-- refreshes (within the hour); the proxy asks the auth server directly and
-- is right at once, so a page never shuts anyone out, and the panel's
-- writes through RLS wait at most that hour. Signing out and in again
-- refreshes it immediately.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Helpers ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_instructor()
RETURNS boolean AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'instructor',
    false
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 2. Carry each role across ────────────────────────────────────────────────
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', raw_user_meta_data ->> 'role')
WHERE raw_user_meta_data ->> 'role' IN ('admin', 'instructor')
  AND COALESCE(raw_app_meta_data ->> 'role', '') <> raw_user_meta_data ->> 'role';

-- ── 3. And leave nothing behind ──────────────────────────────────────────────
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE raw_user_meta_data ? 'role';
