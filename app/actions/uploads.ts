'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

// Public Storage buckets, one per kind of image. Uploads go through the
// service role (bypasses RLS); reads are public via the URL. The client has
// to carry the service key itself — see lib/supabase/service.ts — or the
// upload is made as the signed-in admin and the bucket, which has no write
// policy, refuses it.
//   class-images   — migration 006, the photograph on a class's booking page
//   retreat-images — migration 007, the photograph on a retreat's card
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

type UploadResult = { ok: true; url: string } | { ok: false; error: string };

// Only an admin uploads: the proxy already gates /admin/*, and this repeats
// the check at the action itself.
async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user && user.user_metadata?.role === 'admin';
}

async function uploadImage(bucket: string, folder: string, formData: FormData): Promise<UploadResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'not_allowed' };
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'no_file' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'too_large' };
  if (!ALLOWED.includes(file.type)) return { ok: false, error: 'bad_type' };

  const supabase = createServiceRoleClient();
  const ext = EXT[file.type] ?? 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

// Uploads a class image and returns its public URL. Called from the admin
// class modals (recurring template + one-off calendar session).
export async function uploadClassImage(formData: FormData): Promise<UploadResult> {
  return uploadImage('class-images', 'classes', formData);
}

// Uploads a retreat's photograph and returns its public URL. Called from the
// retreats panel.
export async function uploadRetreatImage(formData: FormData): Promise<UploadResult> {
  return uploadImage('retreat-images', 'retreats', formData);
}
