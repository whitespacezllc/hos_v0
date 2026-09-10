// ─────────────────────────────────────────────────────────────────────────────
// Create (or reset) admin accounts for the House of Shakti panel, ready to
// sign in — no invitation email involved.
//
// For each email it creates the auth user with the given password, the
// address already confirmed, and `app_metadata.role = 'admin'`: the flag the
// proxy, the sign-in page and every panel action check. If the account
// already exists, it sets that password and that role on it instead. Only
// the service key can write app_metadata, which is why this runs here and
// not in the panel.
//
// Run:
//   ADMIN_PASSWORD='the password' node --env-file=.env.local scripts/create-admins.mjs one@email.com two@email.com
//
// Needs in the env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// ADMIN_PASSWORD. The password is read from the environment so it never sits
// in a file or in the shell history as part of the command line (a leading
// space before the command keeps it out of zsh's history too).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.ADMIN_PASSWORD;
const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);

// Name exactly what is missing: the anon key is not enough here, and
// "both missing" when only the service key is sends people the wrong way.
const missing = [
  !SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
  !SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
].filter(Boolean);
if (missing.length) {
  console.error(
    `Missing in the environment: ${missing.join(', ')}.\n` +
      'Add it to .env.local — the service_role key is under Supabase → Project Settings → API Keys (secret, never the anon key) — and run with --env-file=.env.local.',
  );
  process.exit(1);
}
if (!PASSWORD || PASSWORD.length < 10) {
  console.error('Set ADMIN_PASSWORD in the environment (at least 10 characters).');
  process.exit(1);
}
if (emails.length === 0) {
  console.error('Pass at least one email: node --env-file=.env.local scripts/create-admins.mjs one@email.com');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
}

for (const email of emails) {
  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
        app_metadata: { ...(existing.app_metadata ?? {}), role: 'admin' },
      });
      if (error) throw error;
      console.log(`✔ ${email} — existing account: password reset, admin role set`);
    } else {
      const { error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        app_metadata: { role: 'admin' },
      });
      if (error) throw error;
      console.log(`✔ ${email} — created, confirmed, admin`);
    }
  } catch (err) {
    console.error(`✖ ${email}: ${err.message ?? err}`);
    process.exitCode = 1;
  }
}
console.log('\nThey can sign in at <site>/login. "Forgot your password?" on that page sends a reset link by email.');
