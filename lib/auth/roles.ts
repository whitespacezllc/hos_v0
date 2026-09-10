import type { User } from '@supabase/supabase-js';

// ─── Who is who ──────────────────────────────────────────────────────────────
// A role is read from `app_metadata`, never from `user_metadata`. The
// difference is who can write each: `user_metadata` belongs to the user —
// any signed-in account can rewrite its own with the public key — while
// `app_metadata` is only ever set through the service key (the admin API,
// the scripts in /scripts, the SQL editor). A role has to be something only
// the house grants, so it lives on the side only the house can touch.
//
// Every gate reads through here: the proxy, the sign-in pages, the layouts,
// the server actions. One definition, so the panel can never disagree with
// itself about who is an admin.

export type Role = 'admin' | 'instructor';

export function roleOf(user: User | null | undefined): Role | null {
  const role = user?.app_metadata?.role;
  return role === 'admin' || role === 'instructor' ? role : null;
}

export function isAdmin(user: User | null | undefined): boolean {
  return roleOf(user) === 'admin';
}

export function isInstructor(user: User | null | undefined): boolean {
  return roleOf(user) === 'instructor';
}

/**
 * Where a signed-in account belongs: the admin to the panel, an instructor
 * to the portal, anyone else nowhere. Used after a sign-in or a password
 * reset to send the person to their own door.
 */
export function homeFor(user: User | null | undefined): string | null {
  switch (roleOf(user)) {
    case 'admin':
      return '/admin';
    case 'instructor':
      return '/instructor';
    default:
      return null;
  }
}
