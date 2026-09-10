'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createServiceClient } from '@/lib/supabase/server';
import { costaRicaInstant } from '@/lib/costa-rica-time';

// A validity window is typed as two dates; it runs from the first's midnight
// to the last's end of day, in Santa Teresa.
const fromDay = (d?: string) => (d ? costaRicaInstant(d, '00:00').toISOString() : null);
const untilDay = (d?: string) => (d ? new Date(costaRicaInstant(d, '23:59').getTime() + 59_999).toISOString() : null);

type CodeInput = {
  code: string;
  partnerName: string;
  description: string;
  benefitType: 'percentage' | 'fixed' | 'free_upsell';
  discountPercent?: number;
  discountFixed?: number;
  freeUpsellId?: string;
  isActive: boolean;
  usageLimit?: number;
  minPurchaseUsd: number;
  validFrom?: string;
  validUntil?: string;
};

export async function createReferralCode(data: CodeInput) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('referral_codes').insert({
    code: data.code.toUpperCase(),
    partner_name: data.partnerName,
    description: data.description,
    benefit_type: data.benefitType,
    discount_percent: data.discountPercent ?? null,
    discount_fixed: data.discountFixed ?? null,
    free_upsell_id: data.freeUpsellId ?? null,
    is_active: data.isActive,
    usage_limit: data.usageLimit ?? null,
    min_purchase_usd: data.minPurchaseUsd,
    valid_from: fromDay(data.validFrom),
    valid_until: untilDay(data.validUntil),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/refers');
}

export async function updateReferralCode(id: string, data: CodeInput) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('referral_codes').update({
    code: data.code.toUpperCase(),
    partner_name: data.partnerName,
    description: data.description,
    benefit_type: data.benefitType,
    discount_percent: data.discountPercent ?? null,
    discount_fixed: data.discountFixed ?? null,
    free_upsell_id: data.freeUpsellId ?? null,
    is_active: data.isActive,
    usage_limit: data.usageLimit ?? null,
    min_purchase_usd: data.minPurchaseUsd,
    valid_from: fromDay(data.validFrom),
    valid_until: untilDay(data.validUntil),
  }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/refers');
}

export async function toggleReferralCodeActive(id: string) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { data: current, error: fetchError } = await supabase
    .from('referral_codes').select('is_active').eq('id', id).single();
  if (fetchError) throw new Error(fetchError.message);
  const { error } = await supabase.from('referral_codes')
    .update({ is_active: !current.is_active }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/refers');
}

export async function deleteReferralCode(id: string) {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { error } = await supabase.from('referral_codes').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/refers');
}
