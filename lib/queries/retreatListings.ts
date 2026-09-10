import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/service';
import type { RetreatListing } from '@/types';
import type { Database } from '@/types/supabase';

type Row = Database['public']['Tables']['retreat_listings']['Row'];

export function rowToRetreatListing(row: Row): RetreatListing {
  return {
    id: row.id,
    title: row.title,
    label: row.label,
    instructors: row.instructors,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    description: row.description,
    url: row.url,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    imageAltEs: row.image_alt_es,
    labelEs: row.label_es,
    descriptionEs: row.description_es,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// PostgREST's "not in the schema cache" and Postgres's "relation does not
// exist": the two ways a database that has not run migration 007 says so.
const NO_TABLE = new Set(['PGRST205', '42P01']);

/**
 * The published listings, for the public page. Read with the anonymous key
 * and no cookies: the page is cached and rebuilt on a timer and on every
 * save in the panel, and a cookie-bound client would make it render per
 * request instead.
 *
 * Returns null — not an empty list — only when there is nothing to read
 * from: no env, or no table yet. Any other failure throws, on purpose: a
 * page rebuilding in the background that throws keeps serving its last good
 * render, and that render is the admin's real list. Swallowing the error
 * would have the page fall back to the seeds and cache them for the next
 * interval, with whatever the admin changed since gone from view.
 */
export async function getPublishedRetreatListings(): Promise<RetreatListing[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('[getPublishedRetreatListings] Supabase env is not set');
    return null;
  }
  const supabase = createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from('retreat_listings')
    .select('*')
    .eq('is_published', true)
    .order('starts_on', { ascending: true });
  if (error) {
    if (NO_TABLE.has(error.code ?? '')) {
      console.error('[getPublishedRetreatListings] no retreat_listings table yet — migration 007 has not run');
      return null;
    }
    throw new Error(`[getPublishedRetreatListings] ${error.message}`);
  }
  return data.map(rowToRetreatListing);
}

/**
 * Every listing, published or not, for the panel. The service-role client
 * that carries its own key, so the read bypasses RLS whatever session the
 * request came in with. Only the admin page (behind the proxy) calls it.
 * Returns null when the read fails, so the panel can say so instead of
 * showing an empty list and inviting the admin to add the first retreat.
 */
export async function getAllRetreatListings(): Promise<RetreatListing[] | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('retreat_listings')
      .select('*')
      .order('starts_on', { ascending: true });
    if (error) {
      console.error('[getAllRetreatListings]', error.message);
      return null;
    }
    return data.map(rowToRetreatListing);
  } catch (err) {
    console.error('[getAllRetreatListings] unexpected:', err);
    return null;
  }
}
