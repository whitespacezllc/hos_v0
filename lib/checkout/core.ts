import { hasLocale } from 'next-intl';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { routing, type AppLocale } from '@/i18n/routing';
import { notifyBooking } from '@/lib/booking-notify';
import { sendAdminNotification, sendPackCodeEmail } from '@/lib/email';
import { paymentMethodLabel } from '@/lib/payment-methods';
import { orderWasPaid } from '@/lib/checkout/verify';

// ─── The money path's inner workings ─────────────────────────────────────────
// Everything that turns an order into a confirmed class, a paid pack or a
// released spot lives here, and only here. The public server actions
// (app/actions/checkout.ts, packs.ts, bookings.ts) and the Tilopay callback
// are thin doors onto these functions.
//
// This is a plain server module, not a 'use server' file — on purpose. Every
// export of a 'use server' file is a callable endpoint, and "confirm this
// booking as paid" is not something the browser may ask for.
//
// It always talks to Postgres through the session-less service client: the
// cookie-bound one silently acts as whoever is signed in, so an admin trying
// the public flow would hit row-level security in the middle of a payment.

export type Service = ReturnType<typeof createServiceRoleClient>;

export function service(): Service {
  return createServiceRoleClient();
}

export function localeOf(value: unknown): AppLocale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

// Migration 009 adds `locale` to bookings and pack_purchases. Until it has
// been applied, PostgREST refuses the column (PGRST204 from its schema cache,
// 42703 from Postgres itself). A booking must never fail over that, so the
// insert is retried without the column and the email falls back to English.
export function isMissingLocaleColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (error.code === 'PGRST204' || error.code === '42703') && /locale/i.test(error.message ?? '');
}

/** How long an unfinished card checkout may hold a spot before it is released. */
export const CARD_HOLD_MINUTES = 45;

// ─── Spots ───────────────────────────────────────────────────────────────────
export async function reserveSpot(supabase: Service, classId: string): Promise<boolean> {
  const { data } = await supabase.rpc('decrement_spots', { p_class_id: classId });
  return !!(data as { success: boolean } | null)?.success;
}

export async function releaseSpot(supabase: Service, classId: string): Promise<void> {
  await supabase.rpc('increment_spots', { p_class_id: classId });
}

export async function newBookingReference(supabase: Service): Promise<string> {
  const { data } = await supabase.rpc('generate_booking_reference');
  return (data as string | null) ?? `HOS-${Date.now()}-XXXX`;
}

// ─── Codes ───────────────────────────────────────────────────────────────────
export function isPackCode(code: string | null | undefined): code is string {
  return !!code && code.toUpperCase().startsWith('PACK-');
}

/** Consumes one class from a paid pack. Returns what the database said. */
export async function redeemPackCode(
  supabase: Service,
  code: string,
): Promise<{ success: boolean; remaining?: number; error?: string }> {
  const { data, error } = await supabase.rpc('redeem_pack_code', { p_code: code });
  if (error) return { success: false, error: error.message };
  return (data as { success: boolean; remaining?: number; error?: string } | null) ?? { success: false, error: 'no_result' };
}

/** Gives one class back to a pack — a cancelled booking that had used it. */
export async function returnPackCredit(supabase: Service, code: string): Promise<boolean> {
  const { data: pack } = await supabase
    .from('pack_purchases')
    .select('id, classes_used')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (!pack || pack.classes_used <= 0) return false;
  const { error } = await supabase
    .from('pack_purchases')
    .update({ classes_used: pack.classes_used - 1 })
    .eq('id', pack.id)
    .eq('classes_used', pack.classes_used);
  return !error;
}

async function consumeReferralUse(supabase: Service, code: string): Promise<void> {
  const { data: ref } = await supabase
    .from('referral_codes')
    .select('id, usage_count')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (!ref) return;
  await supabase
    .from('referral_codes')
    .update({ usage_count: ref.usage_count + 1 })
    .eq('id', ref.id);
}

/** Consumes whatever code a booking was made with, once it is paid. */
export async function consumeBookingCode(supabase: Service, code: string | null): Promise<void> {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed) return;
  if (isPackCode(trimmed)) {
    const res = await redeemPackCode(supabase, trimmed);
    if (!res.success) console.error('[checkout] pack credit not consumed', trimmed, res.error);
    return;
  }
  await consumeReferralUse(supabase, trimmed);
}

// ─── A booking is paid ───────────────────────────────────────────────────────
/**
 * Confirms a booking whose payment has just been settled — by Tilopay, or by
 * the admin collecting cash / Venmo. Idempotent: a booking already confirmed
 * is left alone. A booking that had been cancelled (a declined attempt, a
 * stale hold) takes its spot back first, because the customer has now paid.
 */
export async function confirmBookingPaid(
  bookingId: string,
  tx: string | null,
): Promise<'confirmed' | 'already_confirmed' | 'not_found'> {
  const supabase = service();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, class_id, payment_status, payment_method, referral_code, booking_reference')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking) return 'not_found';
  if (booking.payment_status === 'confirmed') return 'already_confirmed';

  if (booking.payment_status === 'cancelled') {
    const ok = await reserveSpot(supabase, booking.class_id);
    if (!ok) {
      // Paid, but the class filled up in the meantime. The customer keeps the
      // booking — the studio has to know, and decide.
      console.error('[checkout] confirmed a paid booking on a full class', booking.booking_reference);
    }
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      payment_status: 'confirmed',
      tilopay_transaction: tx ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);
  if (error) {
    console.error('[checkout] confirmBookingPaid update failed', bookingId, error.message);
    return 'not_found';
  }

  await consumeBookingCode(supabase, booking.referral_code);
  await notifyBooking(bookingId, booking.payment_method === 'card' ? 'confirmed' : 'paid');
  return 'confirmed';
}

// ─── A pack is paid ──────────────────────────────────────────────────────────
export type LinkedBooking = { id: string; reference: string; className: string };

export type ConfirmPackResult =
  | {
      ok: true;
      code: string;
      /** false when the purchase was already paid and no new email went out. */
      emailSent: boolean;
      alreadyPaid: boolean;
      customer: { firstName: string; lastName: string; email: string };
      linkedBooking: LinkedBooking | null;
    }
  | { ok: false; error: 'not_found' | 'cancelled' | 'code_generation_failed' | 'database_error' };

async function findLinkedBooking(
  supabase: Service,
  packPurchaseId: string,
): Promise<(LinkedBooking & { status: string; paymentMethod: 'card' | 'cash' | 'venmo' }) | null> {
  const { data } = await supabase
    .from('bookings')
    .select('id, booking_reference, payment_status, payment_method, classes(name)')
    .eq('pack_purchase_id', packPurchaseId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    reference: data.booking_reference,
    className: (data.classes as unknown as { name: string } | null)?.name ?? 'Class',
    status: data.payment_status,
    paymentMethod: data.payment_method ?? 'card',
  };
}

/**
 * Marks a pack purchase paid: generates its personal code, confirms the class
 * that was booked together with it (spending the first credit), and emails
 * the code with the classes that remain. Idempotent under retries and under
 * two callbacks racing each other — the status flip is a conditional update,
 * and only the caller that wins it sends the email.
 */
export async function confirmPackPurchase(
  packPurchaseId: string,
  tx: string | null = null,
): Promise<ConfirmPackResult> {
  const supabase = service();
  const { data: purchase, error: fetchError } = await supabase
    .from('pack_purchases')
    .select('*, class_packs(name)')
    .eq('id', packPurchaseId)
    .maybeSingle();
  if (fetchError || !purchase) return { ok: false, error: 'not_found' };

  const customer = { firstName: purchase.first_name, lastName: purchase.last_name, email: purchase.email };
  const packName = (purchase.class_packs as unknown as { name: string } | null)?.name ?? `Pack x${purchase.classes_total}`;
  const locale = localeOf((purchase as { locale?: string }).locale);

  if (purchase.status === 'cancelled') return { ok: false, error: 'cancelled' };

  if (purchase.status === 'paid' && purchase.code) {
    // Already settled — but a linked booking may still be waiting (e.g. the
    // admin confirmed the pack from /admin/paquetes and now the class).
    const linked = await findLinkedBooking(supabase, packPurchaseId);
    if (linked && linked.status === 'pending') await confirmLinkedBooking(supabase, purchase.code, linked, tx);
    return { ok: true, code: purchase.code, emailSent: false, alreadyPaid: true, customer, linkedBooking: linked };
  }

  const { data: codeData, error: codeError } = await supabase.rpc('generate_pack_code');
  if (codeError || !codeData) {
    console.error('[checkout] pack code generation failed', codeError?.message);
    return { ok: false, error: 'code_generation_failed' };
  }
  const code = codeData as string;

  // Only a pending purchase becomes paid, and only once.
  const { data: flipped, error: updateError } = await supabase
    .from('pack_purchases')
    .update({ status: 'paid', code, paid_at: new Date().toISOString() })
    .eq('id', packPurchaseId)
    .eq('status', 'pending')
    .select('id');
  if (updateError) {
    console.error('[checkout] pack confirm update failed', updateError.message);
    return { ok: false, error: 'database_error' };
  }
  if (!flipped || flipped.length === 0) {
    // Someone else won the race: hand back what they wrote.
    const { data: again } = await supabase.from('pack_purchases').select('code, status').eq('id', packPurchaseId).maybeSingle();
    if (again?.status === 'paid' && again.code) {
      return { ok: true, code: again.code, emailSent: false, alreadyPaid: true, customer, linkedBooking: await findLinkedBooking(supabase, packPurchaseId) };
    }
    return { ok: false, error: 'database_error' };
  }

  // The class bought together with the pack takes the first credit.
  const linked = await findLinkedBooking(supabase, packPurchaseId);
  let used = 0;
  if (linked && linked.status === 'pending') {
    const redeemed = await confirmLinkedBooking(supabase, code, linked, tx);
    if (redeemed) used = 1;
  }

  const emailResult = await sendPackCodeEmail({
    to: purchase.email,
    firstName: purchase.first_name,
    code,
    packName,
    classesTotal: purchase.classes_total,
    classesRemaining: purchase.classes_total - used,
    locale,
  });

  if (!linked) {
    // A pack bought on its own (from /paquetes): the studio hears about it
    // here; a pack bought with a class is reported with that class.
    await sendAdminNotification({
      kind: 'pack',
      status: 'confirmed',
      customerName: `${purchase.first_name} ${purchase.last_name}`,
      customerEmail: purchase.email,
      summary: `${packName} · $${Number(purchase.amount_usd ?? 0)} USD`,
      details: [
        `Pack: ${packName}`,
        `Code: ${code}`,
        `Payment: ${paymentMethodLabel(purchase.payment_method)} · paid`,
        `Amount: $${Number(purchase.amount_usd ?? 0)} USD`,
        `Code email: ${emailResult.sent ? 'sent' : 'NOT sent'}`,
      ],
      adminPath: '/admin/paquetes',
    });
  }

  return { ok: true, code, emailSent: emailResult.sent, alreadyPaid: false, customer, linkedBooking: linked };
}

async function confirmLinkedBooking(
  supabase: Service,
  code: string,
  linked: { id: string; reference: string; paymentMethod: 'card' | 'cash' | 'venmo' },
  tx: string | null,
): Promise<boolean> {
  const redeemed = await redeemPackCode(supabase, code);
  if (!redeemed.success) console.error('[checkout] linked booking credit not consumed', linked.reference, redeemed.error);
  const { error } = await supabase
    .from('bookings')
    .update({
      payment_status: 'confirmed',
      tilopay_transaction: tx ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', linked.id)
    .eq('payment_status', 'pending');
  if (error) {
    console.error('[checkout] linked booking confirm failed', linked.reference, error.message);
    return redeemed.success;
  }
  await notifyBooking(linked.id, linked.paymentMethod === 'card' ? 'confirmed' : 'paid');
  return redeemed.success;
}

// ─── A payment did not happen ────────────────────────────────────────────────
/**
 * Tilopay reported a declined or abandoned payment: release what the order
 * was holding. Only a still-pending order is touched — a replayed or
 * out-of-order callback must never undo a payment that did go through.
 */
export async function releaseOrder(kind: 'booking' | 'pack', id: string): Promise<void> {
  const supabase = service();
  if (kind === 'pack') {
    await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending');
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, class_id, payment_status')
      .eq('pack_purchase_id', id)
      .eq('payment_status', 'pending')
      .maybeSingle();
    if (booking) await cancelPendingBooking(supabase, booking.id, booking.class_id);
    return;
  }
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, class_id, payment_status, pack_purchase_id')
    .eq('id', id)
    .eq('payment_status', 'pending')
    .maybeSingle();
  if (!booking) return;
  await cancelPendingBooking(supabase, booking.id, booking.class_id);
  if (booking.pack_purchase_id) {
    await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', booking.pack_purchase_id).eq('status', 'pending');
  }
}

async function cancelPendingBooking(supabase: Service, bookingId: string, classId: string): Promise<void> {
  const { data } = await supabase
    .from('bookings')
    .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('payment_status', 'pending')
    .select('id');
  if (data && data.length > 0) await releaseSpot(supabase, classId);
}

/**
 * Tilopay says approved, but the callback could not be authenticated. The
 * money may well be real, so nothing is released: the order keeps its spot,
 * remembers the transaction, and waits for the studio to confirm it by hand
 * from the admin panel (after a look at Tilopay's own dashboard).
 */
export async function holdOrderForReview(
  kind: 'booking' | 'pack',
  id: string,
  tx: string | null,
  reason = 'could not be verified',
): Promise<void> {
  const supabase = service();
  let summary = '';
  let customer = { name: '', email: '' };
  let adminPath = '/admin/reservas';
  if (kind === 'booking') {
    const { data: b } = await supabase
      .from('bookings')
      .select('first_name, last_name, email, booking_reference, total_usd, payment_status')
      .eq('id', id)
      .maybeSingle();
    if (!b || b.payment_status !== 'pending') return;
    if (tx) await supabase.from('bookings').update({ tilopay_transaction: tx }).eq('id', id);
    summary = `${b.booking_reference} · $${Number(b.total_usd ?? 0)} USD`;
    customer = { name: `${b.first_name} ${b.last_name}`, email: b.email };
    adminPath = `/admin/reservas?q=${encodeURIComponent(b.booking_reference)}`;
  } else {
    const { data: p } = await supabase
      .from('pack_purchases')
      .select('first_name, last_name, email, amount_usd, status')
      .eq('id', id)
      .maybeSingle();
    if (!p || p.status !== 'pending') return;
    summary = `pack · $${Number(p.amount_usd ?? 0)} USD`;
    customer = { name: `${p.first_name} ${p.last_name}`, email: p.email };
    adminPath = '/admin/paquetes';
  }
  console.error('[tilopay/callback] approved payment held for review', { kind, id, tx, reason });
  await sendAdminNotification({
    kind,
    status: 'pending',
    customerName: customer.name,
    customerEmail: customer.email,
    summary: `Card payment to verify · ${summary}`,
    details: [
      `Tilopay's return reported this card payment as approved, but it could not be verified: ${reason}.`,
      `Transaction: ${tx ?? 'unknown'}`,
      `Check it in the Tilopay dashboard, then use "Confirm payment" in the admin panel.`,
    ],
    adminPath,
  });
}

// ─── Housekeeping ────────────────────────────────────────────────────────────
/**
 * A card checkout that never came back from Tilopay keeps its spot for
 * CARD_HOLD_MINUTES, then lets it go. Cash and Venmo holds are deliberate and
 * stay until the studio collects or cancels them; a hold that carries a
 * Tilopay transaction is waiting for the studio's verification and stays too.
 * Called from the public schedule, so the calendar cleans up after itself.
 */
export async function releaseStaleCardHolds(): Promise<void> {
  try {
    const supabase = service();
    const cutoff = new Date(Date.now() - CARD_HOLD_MINUTES * 60_000).toISOString();
    const { data: stale } = await supabase
      .from('bookings')
      .select('id, class_id, pack_purchase_id, total_usd')
      .eq('payment_method', 'card')
      .eq('payment_status', 'pending')
      .is('tilopay_transaction', null)
      .lt('created_at', cutoff)
      .limit(50);
    for (const b of stale ?? []) {
      // Before letting go: did the customer actually pay, and only the return
      // trip was lost? Tilopay knows. (No answer → leave it for next time.)
      const orderId = b.pack_purchase_id ?? b.id;
      const { data: pack } = b.pack_purchase_id
        ? await supabase.from('pack_purchases').select('amount_usd').eq('id', b.pack_purchase_id).maybeSingle()
        : { data: null };
      const charged = Number(b.total_usd ?? 0) + Number(pack?.amount_usd ?? 0);
      const answer = await orderWasPaid(orderId, charged);
      if (answer === null) continue;
      if (answer.paid) {
        console.warn('[checkout] stale card hold turned out paid — confirming', orderId, answer.transactionId);
        if (b.pack_purchase_id) await confirmPackPurchase(b.pack_purchase_id, answer.transactionId);
        else await confirmBookingPaid(b.id, answer.transactionId);
        continue;
      }
      await cancelPendingBooking(supabase, b.id, b.class_id);
      if (b.pack_purchase_id) {
        await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', b.pack_purchase_id).eq('status', 'pending');
      }
    }
    // Packs started from /paquetes hold nothing, but an abandoned one would
    // sit in the admin's list as "awaiting payment" forever.
    const { data: stalePacks } = await supabase
      .from('pack_purchases')
      .select('id, amount_usd')
      .eq('payment_method', 'card')
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .limit(50);
    for (const p of stalePacks ?? []) {
      const answer = await orderWasPaid(p.id, Number(p.amount_usd ?? 0));
      if (answer === null) continue;
      if (answer.paid) {
        console.warn('[checkout] stale pack purchase turned out paid — confirming', p.id, answer.transactionId);
        await confirmPackPurchase(p.id, answer.transactionId);
        continue;
      }
      await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', p.id).eq('status', 'pending');
    }
  } catch (err) {
    console.error('[checkout] releaseStaleCardHolds', err);
  }
}
