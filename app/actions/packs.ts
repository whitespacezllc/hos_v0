'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { sendPackCodeEmail } from '@/lib/email';
import { createPayment } from '@/lib/tilopay';
import { tilopayReturnUrl } from '@/lib/tilopay-return';
import {
  confirmPackPurchase,
  isMissingLocaleColumn,
  localeOf,
  releaseOrder,
  service,
  type LinkedBooking,
} from '@/lib/checkout/core';
import type { AppLocale } from '@/i18n/routing';

export type PackPurchaseInput = {
  packId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** The language the pack is bought in — stored with it, so the code email speaks it. */
  locale?: AppLocale;
};

// ── The customer buys a pack from /paquetes (card only) ──────────────────────
// Creates a 'pending' purchase and a Tilopay hosted-payment session, and
// returns the URL to send the customer to. The purchase id is Tilopay's
// orderNumber, so the callback can map the result back to it. No code exists
// until the purchase is paid.
export async function startPackCheckout(
  input: PackPurchaseInput,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = service();

  const { data: pack, error: packError } = await supabase
    .from('class_packs')
    .select('id, name, classes_count, price_usd, is_active')
    .eq('id', input.packId)
    .maybeSingle();
  if (packError || !pack || !pack.is_active || pack.classes_count < 2) {
    return { ok: false, error: 'pack_not_found' };
  }

  const row = {
    pack_id: pack.id,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    classes_total: pack.classes_count,
    amount_usd: Number(pack.price_usd),
    status: 'pending',
    payment_method: 'card' as const,
  };
  let res = await supabase.from('pack_purchases').insert({ ...row, locale: localeOf(input.locale) }).select('id').single();
  if (isMissingLocaleColumn(res.error)) res = await supabase.from('pack_purchases').insert(row).select('id').single();
  if (res.error || !res.data) {
    console.error('[startPackCheckout] insert', res.error?.message);
    return { ok: false, error: 'database_error' };
  }
  const purchaseId = res.data.id;

  try {
    const url = await createPayment({
      amount: Number(pack.price_usd).toFixed(2),
      currency: 'USD',
      orderNumber: purchaseId,
      redirect: tilopayReturnUrl(),
      billToFirstName: row.first_name,
      billToLastName: row.last_name,
      billToEmail: row.email,
      billToTelephone: row.phone ?? '',
      billToCountry: 'CR',
      capture: '1',
    });
    return { ok: true, url };
  } catch (err) {
    console.error('[startPackCheckout] tilopay', err);
    await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', purchaseId);
    return { ok: false, error: 'payment_init_failed' };
  }
}

// ── Admin: the payment arrived (cash / Venmo, or a card payment to verify) ───
// Generates the code, confirms the class booked with the pack, emails the code.
export async function confirmPackPayment(id: string): Promise<{
  ok: boolean;
  code?: string;
  emailSent?: boolean;
  alreadyPaid?: boolean;
  error?: string;
  customer?: { firstName: string; lastName: string; email: string };
  linkedBooking?: LinkedBooking | null;
}> {
  await requireAdmin();
  const res = await confirmPackPurchase(id, null);
  revalidatePath('/admin/paquetes');
  revalidatePath('/admin/reservas');
  revalidatePath('/admin/calendario');
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    code: res.code,
    emailSent: res.emailSent,
    alreadyPaid: res.alreadyPaid,
    customer: res.customer,
    linkedBooking: res.linkedBooking,
  };
}

// ── Admin: send the code again (after fixing the email setup, or on request) ─
export async function resendPackCode(
  id: string,
): Promise<{ ok: boolean; emailSent?: boolean; error?: string }> {
  await requireAdmin();
  const supabase = service();
  const { data: purchase, error } = await supabase
    .from('pack_purchases')
    .select('*, class_packs(name)')
    .eq('id', id)
    .maybeSingle();
  if (error || !purchase) return { ok: false, error: 'not_found' };
  if (purchase.status !== 'paid' || !purchase.code) return { ok: false, error: 'not_paid' };

  const packName =
    (purchase.class_packs as unknown as { name: string } | null)?.name ?? `Pack x${purchase.classes_total}`;
  const emailResult = await sendPackCodeEmail({
    to: purchase.email,
    firstName: purchase.first_name,
    code: purchase.code,
    packName,
    classesTotal: purchase.classes_total,
    classesRemaining: purchase.classes_total - purchase.classes_used,
    locale: localeOf((purchase as { locale?: string }).locale),
  });
  return { ok: true, emailSent: emailResult.sent, error: emailResult.error };
}

// ── Admin: the purchase will not be paid ─────────────────────────────────────
// Cancels the purchase and the class booked with it, releasing that spot.
export async function cancelPackPurchase(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const supabase = service();
  const { data: purchase } = await supabase.from('pack_purchases').select('status').eq('id', id).maybeSingle();
  if (!purchase) return { ok: false };
  if (purchase.status === 'pending') {
    await releaseOrder('pack', id);
  } else if (purchase.status === 'paid') {
    // A paid pack is retired, not refunded here: its code stops working.
    const { error } = await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', id);
    if (error) {
      console.error('[cancelPackPurchase]', error.message);
      return { ok: false };
    }
  }
  revalidatePath('/admin/paquetes');
  revalidatePath('/admin/reservas');
  revalidatePath('/admin/calendario');
  return { ok: true };
}
