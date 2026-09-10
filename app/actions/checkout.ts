'use server';

import { createPayment } from '@/lib/tilopay';
import { tilopayReturnUrl } from '@/lib/tilopay-return';
import { notifyBooking } from '@/lib/booking-notify';
import {
  cancelPendingBooking,
  consumeReferralUse,
  isMissingLocaleColumn,
  isPackCode,
  localeOf,
  newBookingReference,
  redeemPackCode,
  releaseSpot,
  reserveSpot,
  returnPackCredit,
  service,
  type Service,
} from '@/lib/checkout/core';
import type { AppLocale } from '@/i18n/routing';

// How the customer chose to pay. 'card' goes through Tilopay; 'cash'/'venmo' are
// paid in person and confirmed manually by the admin from /admin/reservas.
export type CheckoutPaymentMethod = 'card' | 'cash' | 'venmo';

type PersonalData = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  referralCode?: string;
  isHotelGuest: boolean;
  cloudbedsRef?: string;
};

export type CheckoutInput = {
  classId: string;
  upsellIds: string[];
  personalData: PersonalData;
  /** A class pack to buy together with this class (its id in class_packs), or null for a drop-in. */
  packId: string | null;
  paymentMethod: CheckoutPaymentMethod;
  /** The language the booking is made in — stored with it, so every email about it speaks it. */
  locale?: AppLocale;
};

export type CheckoutResult =
  // Fully covered by a pack/referral code — confirmed immediately, no payment.
  | { ok: true; status: 'free'; bookingReference: string }
  // Cash/Venmo — booking created as pending; admin collects payment in person.
  | { ok: true; status: 'offline'; bookingReference: string; paymentMethod: 'cash' | 'venmo' }
  // Card — hand off to Tilopay's hosted payment page.
  | { ok: true; status: 'redirect'; url: string }
  | { ok: false; error: CheckoutError };

export type CheckoutError =
  | 'class_not_found'
  | 'booking_too_late'
  | 'no_spots_available'
  | 'pack_not_found'
  | 'code_invalid'
  | 'already_pending'
  | 'payment_init_failed'
  | 'database_error';

function clean(s: string | undefined): string | null {
  const v = s?.trim();
  return v ? v : null;
}

// ─── What a typed code is worth ──────────────────────────────────────────────
type CodeOutcome =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'pack'; code: string }
  | { kind: 'referral'; code: string; discount: number };

async function evaluateCode(
  supabase: Service,
  raw: string | null,
  classPrice: number,
  upsells: { id: string; price: number }[],
): Promise<CodeOutcome> {
  if (!raw) return { kind: 'none' };
  const code = raw.toUpperCase();
  const upsellsTotal = upsells.reduce((a, u) => a + u.price, 0);
  const base = classPrice + upsellsTotal;

  if (isPackCode(code)) {
    const { data: pack } = await supabase
      .from('pack_purchases')
      .select('status, classes_total, classes_used')
      .eq('code', code)
      .maybeSingle();
    if (pack && pack.status === 'paid' && pack.classes_used < pack.classes_total) return { kind: 'pack', code };
    return { kind: 'invalid' };
  }

  const { data: ref } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();
  if (!ref) return { kind: 'invalid' };
  const now = Date.now();
  const okDates =
    (!ref.valid_from || now >= new Date(ref.valid_from).getTime()) &&
    (!ref.valid_until || now <= new Date(ref.valid_until).getTime());
  const okLimit = ref.usage_limit == null || ref.usage_count < ref.usage_limit;
  const okMin = base >= Number(ref.min_purchase_usd ?? 0);
  if (!okDates || !okLimit || !okMin) return { kind: 'invalid' };

  let discount = 0;
  if (ref.benefit_type === 'percentage' && ref.discount_percent != null) {
    discount = base * (Number(ref.discount_percent) / 100);
  } else if (ref.benefit_type === 'fixed' && ref.discount_fixed != null) {
    discount = Math.min(Number(ref.discount_fixed), base);
  } else if (ref.benefit_type === 'free_upsell' && ref.free_upsell_id) {
    const gift = upsells.find((u) => u.id === ref.free_upsell_id);
    discount = gift ? gift.price : 0;
  }
  return { kind: 'referral', code, discount: Math.round(discount * 100) / 100 };
}

// Starts checkout from the class booking flow.
//  - drop-in: pay this class (+upsells) via Tilopay, or hold it for cash/Venmo.
//    A pack code makes the class free; a referral code discounts it. If the
//    total is 0 the booking is confirmed on the spot.
//  - pack: buy a pack via Tilopay (or hold it for cash/Venmo); once paid, its
//    first credit books THIS class (upsells charged) and the code is emailed.
export async function startBookingCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const supabase = service();
  const { classId, upsellIds, personalData, packId, paymentMethod } = input;
  const locale = localeOf(input.locale);
  const isOffline = paymentMethod === 'cash' || paymentMethod === 'venmo';

  // ── Validate class ──────────────────────────────────────────────────────────
  const { data: clase, error: classError } = await supabase
    .from('classes')
    .select('id, is_active, starts_at, price_dropin_usd')
    .eq('id', classId)
    .maybeSingle();
  if (classError || !clase || !clase.is_active) return { ok: false, error: 'class_not_found' };

  const hoursUntil = (new Date(clase.starts_at).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil < 1) return { ok: false, error: 'booking_too_late' };

  // ── Upsells, priced by the database ─────────────────────────────────────────
  let upsells: { id: string; price: number }[] = [];
  if (upsellIds.length > 0) {
    const { data: rows } = await supabase
      .from('upsells')
      .select('id, price_usd')
      .in('id', upsellIds)
      .eq('is_active', true);
    upsells = (rows ?? []).map((u) => ({ id: u.id, price: Number(u.price_usd) }));
  }
  const upsellsTotal = upsells.reduce((a, u) => a + u.price, 0);
  const validUpsellIds = upsells.map((u) => u.id);
  const classPrice = Number(clase.price_dropin_usd);
  const redirect = tilopayReturnUrl();

  const person = {
    first_name: personalData.firstName.trim(),
    last_name: personalData.lastName.trim(),
    email: personalData.email.trim().toLowerCase(),
    phone: clean(personalData.phone),
  };
  const guest = {
    is_hotel_guest: !!personalData.isHotelGuest,
    cloudbeds_ref: clean(personalData.cloudbedsRef),
  };

  // One open hold per person per class. A second one is almost always a
  // double click or a retry — and cash / Venmo holds cost nothing to make.
  const { data: open } = await supabase
    .from('bookings')
    .select('id')
    .eq('class_id', classId)
    .eq('email', person.email)
    .eq('payment_status', 'pending')
    .limit(1);
  if (open && open.length > 0) return { ok: false, error: 'already_pending' };

  // ══ PACK: buy a pack that also books this class ══════════════════════════════
  if (packId) {
    const { data: pack } = await supabase
      .from('class_packs')
      .select('id, name, classes_count, price_usd, is_active')
      .eq('id', packId)
      .maybeSingle();
    if (!pack || !pack.is_active || pack.classes_count < 2) return { ok: false, error: 'pack_not_found' };

    if (!(await reserveSpot(supabase, classId))) return { ok: false, error: 'no_spots_available' };

    const purchaseRow = {
      pack_id: pack.id,
      ...person,
      classes_total: pack.classes_count,
      amount_usd: Number(pack.price_usd),
      status: 'pending',
      payment_method: paymentMethod,
    };
    let purchaseRes = await supabase.from('pack_purchases').insert({ ...purchaseRow, locale }).select('id').single();
    if (isMissingLocaleColumn(purchaseRes.error)) {
      purchaseRes = await supabase.from('pack_purchases').insert(purchaseRow).select('id').single();
    }
    if (purchaseRes.error || !purchaseRes.data) {
      await releaseSpot(supabase, classId);
      console.error('[checkout] pack purchase insert failed', purchaseRes.error?.message);
      return { ok: false, error: 'database_error' };
    }
    const purchaseId = purchaseRes.data.id;

    const bookingReference = await newBookingReference(supabase);
    const bookingRow = {
      class_id: classId,
      ...person,
      upsell_ids: validUpsellIds,
      payment_status: 'pending' as const,
      payment_method: paymentMethod,
      pack_type: `pack${pack.classes_count}`,
      pack_purchase_id: purchaseId,
      booking_reference: bookingReference,
      ...guest,
      total_usd: upsellsTotal,
    };
    let bookingRes = await supabase.from('bookings').insert({ ...bookingRow, locale }).select('id').single();
    if (isMissingLocaleColumn(bookingRes.error)) {
      bookingRes = await supabase.from('bookings').insert(bookingRow).select('id').single();
    }
    if (bookingRes.error || !bookingRes.data) {
      await releaseSpot(supabase, classId);
      await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', purchaseId);
      console.error('[checkout] pack booking insert failed', bookingRes.error?.message);
      return { ok: false, error: 'database_error' };
    }
    const bookingId = bookingRes.data.id;

    // Cash/Venmo — the pack and the booking wait, pending, for the studio to
    // collect. Confirming either from the admin generates the code and emails it.
    if (isOffline) {
      await notifyBooking(bookingId, 'pending');
      return { ok: true, status: 'offline', bookingReference, paymentMethod };
    }

    try {
      const url = await createPayment({
        amount: (Number(pack.price_usd) + upsellsTotal).toFixed(2),
        currency: 'USD',
        orderNumber: purchaseId, // the callback maps pack purchases by id
        redirect,
        billToFirstName: person.first_name,
        billToLastName: person.last_name,
        billToEmail: person.email,
        billToTelephone: person.phone ?? '',
        billToCountry: 'CR',
        capture: '1',
      });
      return { ok: true, status: 'redirect', url };
    } catch (err) {
      console.error('[checkout] tilopay (pack)', err);
      await abandon(supabase, bookingId, purchaseId);
      return { ok: false, error: 'payment_init_failed' };
    }
  }

  // ══ DROP-IN: pay this class (+upsells); a code may discount or waive it ══════
  const outcome = await evaluateCode(supabase, clean(personalData.referralCode), classPrice, upsells);
  if (outcome.kind === 'invalid') return { ok: false, error: 'code_invalid' };

  const classCharged = outcome.kind === 'pack' ? 0 : classPrice;
  const discount = outcome.kind === 'referral' ? outcome.discount : 0;
  const total = Math.max(0, Math.round((classCharged + upsellsTotal - discount) * 100) / 100);
  const code = outcome.kind === 'none' ? null : outcome.code;

  if (!(await reserveSpot(supabase, classId))) return { ok: false, error: 'no_spots_available' };

  // A pack code is spent now, before the booking exists, whatever the total:
  // a pack that ran out a second ago cannot book, and a booking that dies
  // (declined, abandoned, cancelled) gives the credit back.
  if (outcome.kind === 'pack') {
    const redeemed = await redeemPackCode(supabase, outcome.code);
    if (!redeemed.success) {
      await releaseSpot(supabase, classId);
      return { ok: false, error: 'code_invalid' };
    }
  }

  const bookingReference = await newBookingReference(supabase);
  const bookingRow = {
    class_id: classId,
    ...person,
    upsell_ids: validUpsellIds,
    payment_status: (total <= 0 ? 'confirmed' : 'pending') as 'confirmed' | 'pending',
    payment_method: paymentMethod,
    pack_type: 'dropin',
    booking_reference: bookingReference,
    referral_code: code,
    ...guest,
    total_usd: total,
  };
  let bookingRes = await supabase.from('bookings').insert({ ...bookingRow, locale }).select('id').single();
  if (isMissingLocaleColumn(bookingRes.error)) {
    bookingRes = await supabase.from('bookings').insert(bookingRow).select('id').single();
  }
  if (bookingRes.error || !bookingRes.data) {
    await releaseSpot(supabase, classId);
    if (outcome.kind === 'pack') await returnPackCredit(supabase, outcome.code);
    console.error('[checkout] booking insert failed', bookingRes.error?.message);
    return { ok: false, error: 'database_error' };
  }
  const bookingId = bookingRes.data.id;

  if (total <= 0) {
    // A referral code that covered everything counts as used too.
    if (outcome.kind === 'referral') await consumeReferralUse(supabase, outcome.code);
    await notifyBooking(bookingId, 'confirmed');
    return { ok: true, status: 'free', bookingReference };
  }

  // Cash/Venmo — the spot is held; the studio collects and confirms from
  // /admin/reservas, which also spends the code.
  if (isOffline) {
    await notifyBooking(bookingId, 'pending');
    return { ok: true, status: 'offline', bookingReference, paymentMethod };
  }

  try {
    const url = await createPayment({
      amount: total.toFixed(2),
      currency: 'USD',
      orderNumber: bookingId, // the callback maps bookings by id
      redirect,
      billToFirstName: person.first_name,
      billToLastName: person.last_name,
      billToEmail: person.email,
      billToTelephone: person.phone ?? '',
      billToCountry: 'CR',
      capture: '1',
    });
    return { ok: true, status: 'redirect', url };
  } catch (err) {
    console.error('[checkout] tilopay (drop-in)', err);
    await abandon(supabase, bookingId, null);
    return { ok: false, error: 'payment_init_failed' };
  }
}

// Tilopay could not open a payment session: the rows just created are not an
// order anyone will pay, so they are cancelled, the spot goes back and a pack
// credit the code had spent is returned.
async function abandon(supabase: Service, bookingId: string, purchaseId: string | null): Promise<void> {
  await cancelPendingBooking(supabase, bookingId);
  if (purchaseId) await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', purchaseId);
}
