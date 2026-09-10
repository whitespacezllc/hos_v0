'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { retreatListingSchema, type RetreatListingFormValues } from '@/lib/retreat-listings';
import type { Database } from '@/types/supabase';

// ─── Retreat listings — the panel's writes ───────────────────────────────────
// Create, edit, publish and delete the retreats shown on /upcoming-retreats.
// Every write re-validates with the same schema the form used, so nothing
// the browser skipped gets through, and every write refreshes both the
// panel's list and the public page in both languages. Writes go through the
// service-role client that carries the key itself (lib/supabase/service.ts),
// behind requireAdmin(); the row policies stay as the floor.

type Insert = Database['public']['Tables']['retreat_listings']['Insert'];
type Result = { ok: true } | { ok: false; error: string };

const BUCKET = 'retreat-images';

// The proxy already turns away anyone without an admin session before a
// request reaches /admin/*. Repeating the check at the action itself means a
// call from anywhere else meets the same door.
async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'admin') {
    throw new Error('You need to be signed in as an admin.');
  }
}

// The panel's list, and the public page under both locale prefixes.
function revalidateRetreatPages(): void {
  revalidatePath('/admin/retreats');
  revalidatePath('/[locale]/upcoming-retreats', 'page');
  revalidatePath('/upcoming-retreats');
  revalidatePath('/es/upcoming-retreats');
}

// The form's strings, checked and shaped into a row. Spanish fields left
// empty become NULL — "reuse the English". The alt text is not the form's:
// the page derives one from the name and the facilitator, and the seeded
// rows keep their hand-written alts until their photograph changes (see
// updateRetreatListing).
function toRow(values: RetreatListingFormValues): Insert {
  const v = retreatListingSchema.parse(values);
  return {
    title: v.title,
    label: v.label,
    instructors: v.instructors,
    starts_on: v.startsOn,
    ends_on: v.endsOn,
    description: v.description,
    url: v.url,
    image_url: v.imageUrl || null,
    label_es: v.labelEs || null,
    description_es: v.descriptionEs || null,
    is_published: v.isPublished,
  };
}

function describe(err: unknown): string {
  if (err instanceof ZodError) return err.issues[0]?.message ?? 'Please check the form.';
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export async function createRetreatListing(values: RetreatListingFormValues): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('retreat_listings').insert(toRow(values));
    if (error) throw new Error(error.message);
    revalidateRetreatPages();
    return { ok: true };
  } catch (err) {
    console.error('[createRetreatListing]', err);
    return { ok: false, error: describe(err) };
  }
}

export async function updateRetreatListing(
  id: string,
  values: RetreatListingFormValues,
): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    const row = toRow(values);

    const { data: current, error: fetchError } = await supabase
      .from('retreat_listings')
      .select('image_url')
      .eq('id', id)
      .single();
    if (fetchError) throw new Error(fetchError.message);

    // A new photograph is a new picture: the alt written for the old one
    // goes with it, and the page derives one from the name and the
    // facilitator instead. The old upload goes too, if it was ours.
    const photoChanged = (current.image_url ?? null) !== (row.image_url ?? null);
    const { error } = await supabase
      .from('retreat_listings')
      .update(photoChanged ? { ...row, image_alt: null, image_alt_es: null } : row)
      .eq('id', id);
    if (error) throw new Error(error.message);
    if (photoChanged) await removeUploadedPhoto(supabase, current.image_url);

    revalidateRetreatPages();
    return { ok: true };
  } catch (err) {
    console.error('[updateRetreatListing]', err);
    return { ok: false, error: describe(err) };
  }
}

// A photograph that lives in our bucket is deleted with the row (or when it
// is replaced); one that points into the site's own image bank is left
// alone. Best effort: an orphaned file is untidy, not a failure.
async function removeUploadedPhoto(
  supabase: ReturnType<typeof createServiceRoleClient>,
  url: string | null,
): Promise<void> {
  const marker = `/${BUCKET}/`;
  const at = url?.indexOf(marker) ?? -1;
  if (!url || at < 0) return;
  const path = url.slice(at + marker.length);
  await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
}

export async function setRetreatListingPublished(id: string, isPublished: boolean): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from('retreat_listings')
      .update({ is_published: isPublished })
      .eq('id', id);
    if (error) throw new Error(error.message);
    revalidateRetreatPages();
    return { ok: true };
  } catch (err) {
    console.error('[setRetreatListingPublished]', err);
    return { ok: false, error: describe(err) };
  }
}

// A real delete: nothing references a listing, and a retreat that is over
// has its own place on the page, so hiding is never the reason to delete.
export async function deleteRetreatListing(id: string): Promise<Result> {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    const { data: current, error: fetchError } = await supabase
      .from('retreat_listings')
      .select('image_url')
      .eq('id', id)
      .single();
    if (fetchError) throw new Error(fetchError.message);

    const { error } = await supabase.from('retreat_listings').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await removeUploadedPhoto(supabase, current.image_url);

    revalidateRetreatPages();
    return { ok: true };
  } catch (err) {
    console.error('[deleteRetreatListing]', err);
    return { ok: false, error: describe(err) };
  }
}
