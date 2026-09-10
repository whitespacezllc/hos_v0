// ─────────────────────────────────────────────────────────────────────────────
// Invite admin users to the House of Shakti panel.
//
// For each email it:
//   1. Creates the auth user (or reuses it if it already exists) with
//      app_metadata.role = 'admin' — the flag the proxy, the sign-in page and
//      every panel action check (lib/auth/roles.ts). Setting a password never
//      grants this; only the service key writes app_metadata, which is why
//      this runs server-side and is not something the panel or the
//      /set-password page can do. (To create accounts with a password of your
//      choosing instead of an invitation, see scripts/create-admins.mjs.)
//   2. Generates a one-time link (invite for new users, recovery for existing)
//      and prints a ready-to-share URL that lands on /set-password, where the
//      person chooses their own password and is dropped into /admin.
//
// It sends no email itself, so it needs no SMTP configured and no email
// template edits — you hand each person their link directly.
//
// Run (loads .env.local for the keys):
//   node --env-file=.env.local scripts/invite-admins.mjs
//   node --env-file=.env.local scripts/invite-admins.mjs someone@email.com other@email.com
//
// Requires in the env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// and NEXT_PUBLIC_SITE_URL (the deployed origin, e.g. https://houseofshakticr.com).
// Also add "<SITE_URL>/set-password" to Supabase → Auth → URL Configuration →
// Redirect URLs, or the links are rejected.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// The two admins requested by the client, overridable via CLI args.
const DEFAULT_EMAILS = ['nancyshantishanti@gmail.com', 'houseofshaktiyoga@gmail.com'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing env. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run with: node --env-file=.env.local scripts/invite-admins.mjs',
  );
  process.exit(1);
}

const emails = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_EMAILS;
const redirectTo = `${SITE_URL.replace(/\/$/, '')}/set-password`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Find an existing auth user by email (first page is plenty for a studio).
async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

function shareLink(properties, type) {
  // Prefer building our own /set-password link from the hashed token — it is
  // verified server-side by the page and needs no email template.
  const hashed = properties?.hashed_token;
  if (hashed) return `${redirectTo}?token_hash=${hashed}&type=${type}`;
  // Fallback to Supabase's own action link if the token isn't exposed.
  return properties?.action_link ?? '(no link returned)';
}

async function inviteOne(email) {
  const existing = await findUserByEmail(email);

  if (!existing) {
    // New user — invite link, then the role: generateLink only writes
    // user_metadata, and the role has to live in app_metadata.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo },
    });
    if (error) throw error;
    const { error: roleError } = await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { ...(data.user.app_metadata ?? {}), role: 'admin' },
    });
    if (roleError) throw roleError;
    return { status: 'invited (new user)', link: shareLink(data.properties, 'invite') };
  }

  // Existing user — make sure the role is set, then send a recovery link so
  // they can (re)set their password.
  await admin.auth.admin.updateUserById(existing.id, {
    app_metadata: { ...(existing.app_metadata ?? {}), role: 'admin' },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });
  if (error) throw error;
  return { status: 'role ensured + recovery link (existing user)', link: shareLink(data.properties, 'recovery') };
}

console.log(`\nSite: ${SITE_URL}`);
console.log(`Redirect: ${redirectTo}`);
console.log('Make sure that redirect is allow-listed in Supabase → Auth → URL Configuration.\n');

for (const email of emails) {
  try {
    const { status, link } = await inviteOne(email);
    console.log(`✔ ${email}`);
    console.log(`  ${status}`);
    console.log(`  Send this link to them:\n  ${link}\n`);
  } catch (err) {
    console.error(`✖ ${email}: ${err.message ?? err}\n`);
  }
}
