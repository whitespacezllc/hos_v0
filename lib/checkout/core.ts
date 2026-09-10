import { hasLocale } from 'next-intl';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { routing, type AppLocale } from '@/i18n/routing';
import { notifyBooking } from '@/lib/booking-notify';
import { sendAdminNotification, sendPackCodeEmail } from '@/lib/email';
import { paymentMethodLabel } from '@/lib/payment-methods';
import { consultForSweep } from '@/lib/checkout/verify';

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
//
// Two rules run through the whole file:
//   · every status flip is a conditional update (`.eq('status', previous)`)
//     whose affected rows decide what happens next, so two callers racing on
//     the same order — the callback and the sweep, the admin and the customer
//     — never both spend a credit or both send an email;
//   · a pack credit is spent when the order is created and given back when
//     the order dies (declined, abandoned, cancelled), never at confirmation.

export type Service = ReturnType<typeof createServiceRoleClient>;

export function service(): Service {
  return createServiceRoleClient();
}

export function localeOf(value: unknown): AppLocale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

// Migration 009 adds columns (`locale`, `pack_purchases.tilopay_transaction`).
// Until it has been applied, PostgREST refuses them (PGRST204 from its schema
// cache, 42703 from Postgres). Reads use `select('*')`, which never names a
// column; writes that name one are retried or skipped through this check.
export function isMissingColumn(error: { code?: string; message?: string } | null, column: string): boolean {
  if (!error) return false;
  return (error.code === 'PGRST204' || error.code === '42703') && new RegExp(column, 'i').test(error.message ?? '');
}
export const isMissingLocaleColumn = (error: { code?: string; message?: string } | null) => isMissingColumn(error, 'locale');

/** How long an unfinished card checkout may hold a spot before it is released. */
export const CARD_HOLD_MINUTES = 45;

// ─── Spots ───────────────────────────────────────────────────────────────────
export async function reserveSpot(supabase: Service, classId: string): Promise<boolean> {
  const { data } = await supabase.rpc('decrement_spots', { p_class_id: classId });
  return !!(data as { success: boolean } | null)?.success;
}

export async function releaseSpot(supabase: Service, classId: string, count = 1): Promise<void> {
  for (let i = 0; i < Math.max(1, count); i++) {
    await supabase.rpc('increment_spots', { p_class_id: classId });
  }
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

/** Gives one class back to a pack — an order that had spent it died. */
export async function returnPackCredit(supabase: Service, code: string): Promise<boolean> {
  const { data: pack } = await supabase
    .from('pack_purchases')
    .select('id, classes_used')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (!pack || pack.classes_used <= 0) return false;
  const { data } = await supabase
    .from('pack_purchases')
    .update({ classes_used: pack.classes_used - 1 })
    .eq('id', pack.id)
    .eq('classes_used', pack.classes_used)
    .select('id');
  return !!data && data.length > 0;
}

/** Counts one use of a referral code, once its booking is paid. */
export async function consumeReferralUse(supabase: Service, code: string | null): Promise<void> {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed || isPackCode(trimmed)) return;
  const { data: ref } = await supabase
    .from('referral_codes')
    .select('id, usage_count')
    .eq('code', trimmed)
    .maybeSingle();
  if (!ref) return;
  await supabase
    .from('referral_codes')
    .update({ usage_count: ref.usage_count + 1 })
    .eq('id', ref.id);
}

// ─── A booking is paid ───────────────────────────────────────────────────────
/**
 * Confirms a booking whose payment has just been settled — by Tilopay, or by
 * the admin collecting cash / Venmo. Idempotent: a booking already confirmed
 * is left alone, and of two callers racing only the one that flips the row
 * consumes the code and sends the email. A booking that had been cancelled
 * (a declined attempt, a stale hold) takes its spot — and its pack credit —
 * back first, because the customer has now paid.
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
  const previous = booking.payment_status;

  if (previous === 'cancelled') {
    const ok = await reserveSpot(supabase, booking.class_id);
    if (!ok) {
      // Paid, but the class filled up in the meantime. The customer keeps the
      // booking — the studio has to know, and decide.
      console.error('[checkout] confirmed a paid booking on a full class', booking.booking_reference);
    }
  }

  const { data: flipped, error } = await supabase
    .from('bookings')
    .update({
      payment_status: 'confirmed',
      tilopay_transaction: tx ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .eq('payment_status', previous)
    .select('id');
  if (error) {
    console.error('[checkout] confirmBookingPaid update failed', bookingId, error.message);
    return 'not_found';
  }
  if (!flipped || flipped.length === 0) {
    // Someone else flipped it first; undo the spot we took for a revival.
    if (previous === 'cancelled') await releaseSpot(supabase, booking.class_id);
    return 'already_confirmed';
  }

  // A revived booking had its pack credit returned when it was cancelled.
  if (previous === 'cancelled' && isPackCode(booking.referral_code)) {
    const res = await redeemPackCode(supabase, booking.referral_code);
    if (!res.success) console.error('[checkout] pack credit not re-spent on revival', booking.booking_reference, res.error);
  }
  await consumeReferralUse(supabase, booking.referral_code);
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
  | { ok: false; error: 'not_found' | 'code_generation_failed' | 'database_error' };

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'no-show';

type LinkedRow = LinkedBooking & {
  classId: string;
  status: BookingStatus;
  paymentMethod: 'card' | 'cash' | 'venmo';
};

async function findLinkedBooking(supabase: Service, packPurchaseId: string): Promise<LinkedRow | null> {
  const { data } = await supabase
    .from('bookings')
    .select('id, class_id, booking_reference, payment_status, payment_method, classes(name)')
    .eq('pack_purchase_id', packPurchaseId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    classId: data.class_id,
    reference: data.booking_reference,
    className: (data.classes as unknown as { name: string } | null)?.name ?? 'Class',
    status: data.payment_status as BookingStatus,
    paymentMethod: data.payment_method ?? 'card',
  };
}

/**
 * Marks a pack purchase paid: generates its personal code, confirms the class
 * that was booked together with it (spending the first credit), and emails
 * the code with the classes that remain. A purchase the sweep or the admin
 * had cancelled is revived — the payment is real. Idempotent under retries
 * and under two callbacks racing each other: the status flip is a conditional
 * update, and only the caller that wins it sends the email.
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

  if (purchase.status === 'paid' && purchase.code) {
    // Already settled — but a linked booking may still be waiting (e.g. the
    // admin confirmed the pack from /admin/paquetes and now the class).
    const linked = await findLinkedBooking(supabase, packPurchaseId);
    if (linked && linked.status !== 'confirmed') await confirmLinkedBooking(supabase, purchase.code, linked, tx);
    return { ok: true, code: purchase.code, emailSent: false, alreadyPaid: true, customer, linkedBooking: linked };
  }

  const { data: codeData, error: codeError } = await supabase.rpc('generate_pack_code');
  if (codeError || !codeData) {
    console.error('[checkout] pack code generation failed', codeError?.message);
    return { ok: false, error: 'code_generation_failed' };
  }
  const code = codeData as string;

  // Only an unpaid purchase becomes paid, and only once.
  const { data: flipped, error: updateError } = await supabase
    .from('pack_purchases')
    .update({ status: 'paid', code, paid_at: new Date().toISOString() })
    .eq('id', packPurchaseId)
    .in('status', ['pending', 'cancelled'])
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
  await stampPackTransaction(supabase, packPurchaseId, tx);

  // The class bought together with the pack takes the first credit.
  const linked = await findLinkedBooking(supabase, packPurchaseId);
  let used = 0;
  if (linked && linked.status !== 'confirmed') {
    if (await confirmLinkedBooking(supabase, code, linked, tx)) used = 1;
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

// Flips the linked booking first; only the caller whose update lands spends
// the credit and sends the email. A booking the sweep or the admin had
// cancelled gets its spot back: the pack it was waiting for is now paid.
async function confirmLinkedBooking(
  supabase: Service,
  code: string,
  linked: LinkedRow,
  tx: string | null,
): Promise<boolean> {
  if (linked.status === 'cancelled') {
    const ok = await reserveSpot(supabase, linked.classId);
    if (!ok) console.error('[checkout] revived a paid pack booking on a full class', linked.reference);
  }
  const { data: flipped, error } = await supabase
    .from('bookings')
    .update({
      payment_status: 'confirmed',
      tilopay_transaction: tx ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', linked.id)
    .eq('payment_status', linked.status)
    .select('id');
  if (error || !flipped || flipped.length === 0) {
    if (error) console.error('[checkout] linked booking confirm failed', linked.reference, error.message);
    if (linked.status === 'cancelled') await releaseSpot(supabase, linked.classId);
    return false;
  }
  const redeemed = await redeemPackCode(supabase, code);
  if (!redeemed.success) console.error('[checkout] linked booking credit not consumed', linked.reference, redeemed.error);
  await notifyBooking(linked.id, linked.paymentMethod === 'card' ? 'confirmed' : 'paid');
  return true;
}

// pack_purchases.tilopay_transaction arrives with migration 009; before it,
// the stamp is simply skipped.
async function stampPackTransaction(supabase: Service, packPurchaseId: string, tx: string | null): Promise<void> {
  if (!tx) return;
  const { error } = await supabase
    .from('pack_purchases')
    .update({ tilopay_transaction: tx })
    .eq('id', packPurchaseId);
  if (error && !isMissingColumn(error, 'tilopay_transaction')) {
    console.error('[checkout] pack transaction stamp failed', packPurchaseId, error.message);
  }
}

// ─── A payment did not happen ────────────────────────────────────────────────
/**
 * Cancels a booking that is still pending, gives its spot back and returns
 * the pack credit it had spent. Only the caller whose update lands does the
 * bookkeeping, so a double release cannot free two seats.
 */
export async function cancelPendingBooking(supabase: Service, bookingId: string): Promise<boolean> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, class_id, persons, referral_code, payment_status')
    .eq('id', bookingId)
    .eq('payment_status', 'pending')
    .maybeSingle();
  if (!booking) return false;
  const { data } = await supabase
    .from('bookings')
    .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('payment_status', 'pending')
    .select('id');
  if (!data || data.length === 0) return false;
  await releaseSpot(supabase, booking.class_id, booking.persons ?? 1);
  if (isPackCode(booking.referral_code)) await returnPackCredit(supabase, booking.referral_code);
  return true;
}

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
      .select('id')
      .eq('pack_purchase_id', id)
      .eq('payment_status', 'pending')
      .maybeSingle();
    if (booking) await cancelPendingBooking(supabase, booking.id);
    return;
  }
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, pack_purchase_id')
    .eq('id', id)
    .eq('payment_status', 'pending')
    .maybeSingle();
  if (!booking) return;
  await cancelPendingBooking(supabase, booking.id);
  if (booking.pack_purchase_id) {
    await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', booking.pack_purchase_id).eq('status', 'pending');
  }
}

/**
 * Tilopay says approved, but the payment could not be verified one way or the
 * other. The money may well be real, so nothing is released: the order
 * remembers the transaction (which also keeps the sweep off it) and the
 * studio is told once — a second call for the same order sends nothing.
 */
export async function holdOrderForReview(
  kind: 'booking' | 'pack',
  id: string,
  tx: string | null,
  reason = 'could not be verified',
): Promise<void> {
  const supabase = service();
  const marker = tx ?? 'unverified';
  let summary = '';
  let customer = { name: '', email: '' };
  let adminPath = '/admin/reservas';
  let reference = id;

  if (kind === 'booking') {
    const { data: b } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle();
    if (!b || b.payment_status === 'confirmed') return;
    if (b.tilopay_transaction) return; // already held and reported
    const { data: stamped } = await supabase
      .from('bookings')
      .update({ tilopay_transaction: marker })
      .eq('id', id)
      .is('tilopay_transaction', null)
      .select('id');
    if (!stamped || stamped.length === 0) return;
    summary = `${b.booking_reference} · $${Number(b.total_usd ?? 0)} USD`;
    customer = { name: `${b.first_name} ${b.last_name}`, email: b.email };
    adminPath = `/admin/reservas?q=${encodeURIComponent(b.booking_reference)}`;
    reference = b.booking_reference;
  } else {
    const { data: p } = await supabase.from('pack_purchases').select('*').eq('id', id).maybeSingle();
    if (!p || p.status === 'paid') return;
    const row = p as { tilopay_transaction?: string | null };
    const linked = await findLinkedBooking(supabase, id);
    if (row.tilopay_transaction) return; // already held and reported
    // The pack's own column exists from migration 009; the linked booking's
    // always has. Either keeps the sweep away.
    await stampPackTransaction(supabase, id, marker);
    if (linked) {
      const { data: stamped } = await supabase
        .from('bookings')
        .update({ tilopay_transaction: marker })
        .eq('id', linked.id)
        .is('tilopay_transaction', null)
        .select('id');
      if (row.tilopay_transaction === undefined && (!stamped || stamped.length === 0)) return; // no column, and the booking was already marked
    }
    summary = `pack · $${Number(p.amount_usd ?? 0)} USD${linked ? ` · ${linked.reference}` : ''}`;
    customer = { name: `${p.first_name} ${p.last_name}`, email: p.email };
    adminPath = linked ? `/admin/reservas?q=${encodeURIComponent(linked.reference)}` : '/admin/paquetes';
    reference = linked?.reference ?? id;
  }

  console.error('[tilopay/callback] approved payment held for review', { kind, id, tx, reason });
  await sendAdminNotification({
    kind,
    status: 'review',
    customerName: customer.name,
    customerEmail: customer.email,
    summary,
    details: [
      `Order: ${reference}`,
      `Transaction: ${tx ?? 'not reported'}`,
      `Reason: ${reason}`,
      `Next step: check the payment in the Tilopay dashboard, then use "Confirm payment" in the admin panel — or "Cancel" if it never went through`,
    ],
    adminPath,
  });
}

// ─── Housekeeping ────────────────────────────────────────────────────────────
// Runs from the public schedule after the response has gone out, at most once
// every few minutes per server, a handful of orders at a time.
const SWEEP_EVERY_MS = 5 * 60_000;
const SWEEP_BATCH = 10;
let lastSweepAt = 0;

/**
 * A card checkout that never came back from Tilopay keeps its spot for
 * CARD_HOLD_MINUTES, then — after asking Tilopay whether it was paid after
 * all — lets it go. Cash and Venmo holds are deliberate and stay until the
 * studio collects or cancels them; a hold that carries a Tilopay transaction
 * is waiting for the studio's verification and stays too.
 */
export async function releaseStaleCardHolds(force = false): Promise<void> {
  if (!force && Date.now() - lastSweepAt < SWEEP_EVERY_MS) return;
  lastSweepAt = Date.now();
  try {
    const supabase = service();
    const cutoff = new Date(Date.now() - CARD_HOLD_MINUTES * 60_000).toISOString();
    const { data: stale } = await supabase
      .from('bookings')
      .select('id, class_id, pack_purchase_id, total_usd, booking_reference')
      .eq('payment_method', 'card')
      .eq('payment_status', 'pending')
      .is('tilopay_transaction', null)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(SWEEP_BATCH);
    for (const b of stale ?? []) {
      // Before letting go: did the customer actually pay, and only the return
      // trip was lost? Tilopay knows. (No answer → leave it for next time.)
      const orderId = b.pack_purchase_id ?? b.id;
      const { data: pack } = b.pack_purchase_id
        ? await supabase.from('pack_purchases').select('amount_usd').eq('id', b.pack_purchase_id).maybeSingle()
        : { data: null };
      const charged = Number(b.total_usd ?? 0) + Number(pack?.amount_usd ?? 0);
      const answer = await consultForSweep(orderId, charged);
      if (answer === null) continue;
      if (answer.outcome === 'paid') {
        console.warn('[checkout] stale card hold turned out paid — confirming', b.booking_reference, answer.transactionId);
        if (b.pack_purchase_id) await confirmPackPurchase(b.pack_purchase_id, answer.transactionId);
        else await confirmBookingPaid(b.id, answer.transactionId);
        continue;
      }
      if (answer.outcome === 'amount_mismatch') {
        await holdOrderForReview(b.pack_purchase_id ? 'pack' : 'booking', orderId, answer.transactionId, answer.reason);
        continue;
      }
      await cancelPendingBooking(supabase, b.id);
      if (b.pack_purchase_id) {
        await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', b.pack_purchase_id).eq('status', 'pending');
      }
    }
    // Packs started from /paquetes hold nothing, but an abandoned one would
    // sit in the admin's list as "awaiting payment" forever. Packs bought
    // with a class are handled above, with that class.
    const { data: stalePacks } = await supabase
      .from('pack_purchases')
      .select('*')
      .eq('payment_method', 'card')
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(SWEEP_BATCH);
    for (const p of stalePacks ?? []) {
      if ((p as { tilopay_transaction?: string | null }).tilopay_transaction) continue;
      const { data: linked } = await supabase.from('bookings').select('id').eq('pack_purchase_id', p.id).limit(1);
      if (linked && linked.length > 0) continue;
      const answer = await consultForSweep(p.id, Number(p.amount_usd ?? 0));
      if (answer === null) continue;
      if (answer.outcome === 'paid') {
        console.warn('[checkout] stale pack purchase turned out paid — confirming', p.id, answer.transactionId);
        await confirmPackPurchase(p.id, answer.transactionId);
        continue;
      }
      if (answer.outcome === 'amount_mismatch') {
        await holdOrderForReview('pack', p.id, answer.transactionId, answer.reason);
        continue;
      }
      await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', p.id).eq('status', 'pending');
    }
  } catch (err) {
    console.error('[checkout] releaseStaleCardHolds', err);
  }
}
