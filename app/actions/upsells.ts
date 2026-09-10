'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createServiceClient } from '@/lib/supabase/server';

export async function createUpsell(data: {
  name: string;
  description: string;
  priceUsd: number;
  isActive: boolean;
}) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('upsells').insert({
    name: data.name,
    description: data.description,
    price_usd: data.priceUsd,
    is_active: data.isActive,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/upsells');
}

export async function updateUpsell(
  id: string,
  data: { name: string; description: string; priceUsd: number; isActive: boolean },
) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('upsells').update({
    name: data.name,
    description: data.description,
    price_usd: data.priceUsd,
    is_active: data.isActive,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/upsells');
}

export async function toggleUpsellActive(id: string) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { data: current, error: fetchError } = await supabase
    .from('upsells').select('is_active').eq('id', id).single();
  if (fetchError) throw new Error(fetchError.message);
  const { error } = await supabase.from('upsells')
    .update({ is_active: !current.is_active }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/upsells');
}

export async function deleteUpsell(id: string) {
  await requireAdmin();
  // Soft delete: marcamos como inactivo para no romper bookings que lo referencian
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from('upsells')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/upsells');
}
