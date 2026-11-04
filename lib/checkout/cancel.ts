import { notifyBooking } from '@/lib/booking-notify';
import { isPackCode, releaseSpot, returnPackCredit, service } from '@/lib/checkout/core';

// ─── Cancelling bookings ─────────────────────────────────────────────────────
// Everything a cancellation has to do, in one place: from a booking the admin
// cancels, and from a class the studio takes off the schedule with people in it.
//
// Who cancels decides what the customer is told, so it is always stated. Under
// the shala's policy a class the studio cancels can be rescheduled or refunded;
// one the student cancels can't be refunded, and an email can't be taken back.
export type CancelledBy = 'studio' | 'customer';

export type CancelResult = {
  /** False when it was already cancelled, or another admin got there first. */
  cancelled: boolean;
  /** Whether the customer's email actually went out. */
  emailSent: boolean;
};

const NOTHING: CancelResult = { cancelled: false, emailSent: false };

// Its spots go back, a pending pack bought with it is cancelled so no code is
// ever generated, the pack credit it had spent is returned, and the customer is
// told. Only the caller whose update lands does the bookkeeping, so two admins
// cancelling at once free one seat.
export async function cancelBooking(id: string, cancelledBy: CancelledBy): Promise<CancelResult> {
  const supabase = service();

  const { data: booking } = await supabase
    .from('bookings')
    .select('class_id, persons, payment_status, pack_purchase_id, referral_code, tilopay_transaction')
    .eq('id', id)
    .maybeSingle();
  if (!booking) throw new Error('booking_not_found');
  if (booking.payment_status === 'cancelled') return NOTHING;

  const { data: flipped } = await supabase
    .from('bookings')
    .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('payment_status', booking.payment_status)
    .select('id');
  if (!flipped || flipped.length === 0) return NOTHING;
  await releaseSpot(supabase, booking.class_id, booking.persons ?? 1);

  let creditReturned = false;
  if (booking.pack_purchase_id) {
    // Never paid: the pack dies with the booking. Paid: this class had spent
    // its first credit — give it back.
    const { data: purchase } = await supabase
      .from('pack_purchases')
      .select('status, code')
      .eq('id', booking.pack_purchase_id)
      .maybeSingle();
    if (purchase?.status === 'pending') {
      await supabase.from('pack_purchases').update({ status: 'cancelled' }).eq('id', booking.pack_purchase_id);
    } else if (purchase?.status === 'paid' && purchase.code && booking.payment_status === 'confirmed') {
      creditReturned = await returnPackCredit(supabase, purchase.code);
    }
  } else if (isPackCode(booking.referral_code) && booking.payment_status !== 'no-show') {
    // The credit was spent when the booking was made, paid or not.
    creditReturned = await returnPackCredit(supabase, booking.referral_code);
  }

  const emailSent = await notifyBooking(id, 'cancelled', {
    creditReturned,
    cancelledBy,
    // A card payment waiting to be verified counts: the money may well have moved.
    wasPaid:
      booking.payment_status === 'confirmed' ||
      (booking.payment_status === 'pending' && !!booking.tilopay_transaction),
  });
  return { cancelled: true, emailSent };
}

// Resend's default limit is two requests a second, and a refused send isn't
// retried: without a pause a full class would lose people's emails.
const PAUSE_BETWEEN_EMAILS_MS = 550;

export type ClassCancellation = {
  /** Bookings cancelled. */
  cancelled: number;
  /** How many people weren't told: the email failed, or their booking couldn't be cancelled. */
  emailsFailed: number;
};

/**
 * The studio is taking classes off the schedule: whoever is booked into them
 * hears about it. One queue for all of them, so the pause holds across classes
 * too. Only classes still to come: tidying up last week's calendar must not
 * email anybody, and its bookings are the record of who came.
 */
export async function cancelClassBookings(classIds: string[]): Promise<ClassCancellation> {
  const tally: ClassCancellation = { cancelled: 0, emailsFailed: 0 };
  if (classIds.length === 0) return tally;
  const supabase = service();

  const { data: upcoming, error: classesError } = await supabase
    .from('classes')
    .select('id')
    .in('id', classIds)
    .gt('starts_at', new Date().toISOString());
  if (classesError) throw new Error(classesError.message);
  const ids = (upcoming ?? []).map((c) => c.id);
  if (ids.length === 0) return tally;

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id')
    .in('class_id', ids)
    .in('payment_status', ['pending', 'confirmed']);
  if (error) throw new Error(error.message);

  for (const [i, booking] of (bookings ?? []).entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_EMAILS_MS));
    // One booking that stumbles must not leave the rest of the class unaware.
    try {
      const res = await cancelBooking(booking.id, 'studio');
      if (res.cancelled) {
        tally.cancelled++;
        if (!res.emailSent) tally.emailsFailed++;
      }
    } catch (err) {
      console.error('[cancelClassBookings]', booking.id, err);
      tally.emailsFailed++;
    }
  }
  return tally;
}
