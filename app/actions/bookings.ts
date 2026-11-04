'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { notifyBooking } from '@/lib/booking-notify';
import { isOnSchedule } from '@/types';
import {
  confirmBookingPaid,
  confirmPackPurchase,
  newBookingReference,
  releaseSpot,
  reserveSpot,
  service,
} from '@/lib/checkout/core';
import { cancelBooking, type CancelledBy } from '@/lib/checkout/cancel';

function refreshAdmin() {
  revalidatePath('/admin/reservas');
  revalidatePath('/admin/calendario');
  revalidatePath('/admin/paquetes');
}

// Marks a booking as collected (paid). This is the "Mark as paid" action the
// admin uses for cash/Venmo bookings — and "Confirm payment" for a card
// booking whose Tilopay return never arrived or could not be verified.
//   - Booking bought with a pack → the pack is paid: code generated and
//     emailed, one credit spent on this class, class confirmed.
//   - Drop-in → confirmed; the referral or pack code it used is consumed.
export async function confirmBooking(id: string) {
  await requireAdmin();
  const supabase = service();
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('pack_purchase_id, tilopay_transaction')
    .eq('id', id)
    .maybeSingle();
  if (error || !booking) throw new Error(error?.message ?? 'booking_not_found');

  if (booking.pack_purchase_id) {
    const res = await confirmPackPurchase(booking.pack_purchase_id, booking.tilopay_transaction ?? null);
    if (!res.ok) throw new Error(res.error);
  } else {
    await confirmBookingPaid(id, booking.tilopay_transaction ?? null);
  }
  refreshAdmin();
}

// Admin manually registers a walk-in participant on a class from the calendar
// drawer — for students who show up in person and never booked through the web.
// Mirrors the public drop-in booking shape (same personal fields) but skips the
// upsell/pack flow: it's a quick express add. Reserves `persons` spots atomically
// and rolls them back if anything fails. No email goes out: the person is
// standing at the desk.
export type AdminBookingInput = {
  classId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  persons: number;
  upsellIds?: string[];
  paymentMethod: 'card' | 'cash' | 'venmo';
  /** true → booking is created already paid (confirmed); false → pending. */
  markPaid: boolean;
  isHotelGuest?: boolean;
  cloudbedsRef?: string;
};

export async function createAdminBooking(
  input: AdminBookingInput,
): Promise<{ ok: true; bookingReference: string } | { ok: false; error: string }> {
  await requireAdmin();
  const supabase = service();

  const persons = Math.max(1, Math.floor(input.persons || 1));
  const upsellIds = input.upsellIds ?? [];

  const { data: clase, error: classError } = await supabase
    .from('classes')
    .select('id, price_dropin_usd, is_active, class_templates (is_active)')
    .eq('id', input.classId)
    .maybeSingle();
  if (classError || !clase || !isOnSchedule(clase)) return { ok: false, error: 'class_not_found' };

  // Upsells priced server-side; never trust a client amount.
  let upsellsTotal = 0;
  if (upsellIds.length > 0) {
    const { data: rows } = await supabase.from('upsells').select('price_usd').in('id', upsellIds);
    upsellsTotal = (rows ?? []).reduce((acc, u) => acc + Number(u.price_usd), 0);
  }

  let reserved = 0;
  for (let i = 0; i < persons; i++) {
    if (!(await reserveSpot(supabase, input.classId))) break;
    reserved++;
  }
  if (reserved < persons) {
    for (let i = 0; i < reserved; i++) await releaseSpot(supabase, input.classId);
    return { ok: false, error: 'no_spots_available' };
  }

  const bookingReference = await newBookingReference(supabase);
  const total = Number(clase.price_dropin_usd) * persons + upsellsTotal;

  const { error: insertError } = await supabase.from('bookings').insert({
    class_id: input.classId,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() ? input.phone.trim() : null,
    persons,
    upsell_ids: upsellIds,
    payment_status: input.markPaid ? 'confirmed' : 'pending',
    payment_method: input.paymentMethod,
    pack_type: 'dropin',
    booking_reference: bookingReference,
    is_hotel_guest: input.isHotelGuest ?? false,
    cloudbeds_ref: input.cloudbedsRef?.trim() ? input.cloudbedsRef.trim() : null,
    total_usd: total,
  });
  if (insertError) {
    for (let i = 0; i < reserved; i++) await releaseSpot(supabase, input.classId);
    console.error('[createAdminBooking]', insertError.message);
    return { ok: false, error: 'database_error' };
  }

  refreshAdmin();
  return { ok: true, bookingReference };
}

export async function markNoShow(id: string) {
  await requireAdmin();
  const supabase = service();
  const { error } = await supabase
    .from('bookings')
    .update({ payment_status: 'no-show', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  refreshAdmin();
}

// Cancels a booking from the admin (see lib/checkout/cancel.ts). Who cancels
// decides what the customer's email offers, so anything but a clear "studio"
// reads as "customer": never promise a refund by accident.
export async function cancelBookingAdmin(
  id: string,
  cancelledBy: CancelledBy,
): Promise<{ emailSent: boolean }> {
  await requireAdmin();
  const res = await cancelBooking(id, cancelledBy === 'studio' ? 'studio' : 'customer');
  refreshAdmin();
  // Nothing happened (it was already cancelled), so there is nothing to report.
  return { emailSent: res.emailSent || !res.cancelled };
}
