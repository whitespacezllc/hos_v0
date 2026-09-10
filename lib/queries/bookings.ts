import { createClient } from '@/lib/supabase/server';
import type { Booking, BookingStatus } from '@/types';
import type { Database } from '@/types/supabase';

type BookingRow = Database['public']['Tables']['bookings']['Row'];

// Maps DB status to the legacy frontend paymentStatus
function dbStatusToFrontend(
  status: BookingRow['payment_status'],
): Booking['paymentStatus'] {
  if (status === 'confirmed') return 'paid';
  return status as Booking['paymentStatus'];
}

type PackJoin = { id: string; amount_usd: number | null; status: string; code: string | null } | null;

function rowToBooking(row: BookingRow & { classes?: { name: string } | null; pack_purchases?: PackJoin }): Booking {
  return {
    id: row.id,
    classId: row.class_id,
    className: (row.classes as { name: string } | null)?.name ?? '',
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone ?? undefined,
    persons: row.persons,
    upsells: row.upsell_ids ?? [],
    paymentStatus: dbStatusToFrontend(row.payment_status),
    paymentMethod: row.payment_method ?? 'card',
    bookingReference: row.booking_reference,
    referralCode: row.referral_code ?? undefined,
    totalUsd: Number(row.total_usd ?? 0),
    packPurchase: row.pack_purchases
      ? {
          id: row.pack_purchases.id,
          amountUsd: Number(row.pack_purchases.amount_usd ?? 0),
          status: row.pack_purchases.status,
          code: row.pack_purchases.code,
        }
      : undefined,
    tilopayTransaction: row.tilopay_transaction ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

export async function getBookingByReference(ref: string): Promise<Booking | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('*, classes(name), pack_purchases(id, amount_usd, status, code)')
      .eq('booking_reference', ref)
      .single();

    if (error) {
      console.error('[getBookingByReference]', error.message);
      return null;
    }
    return rowToBooking(data as unknown as BookingRow & { classes: { name: string } | null; pack_purchases: PackJoin });
  } catch (err) {
    console.error('[getBookingByReference] unexpected:', err);
    return null;
  }
}

export async function getBookingsForClass(classId: string): Promise<Booking[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('*, classes(name), pack_purchases(id, amount_usd, status, code)')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getBookingsForClass]', error.message);
      return [];
    }
    return (data as unknown as (BookingRow & { classes: { name: string } | null; pack_purchases: PackJoin })[]).map(rowToBooking);
  } catch (err) {
    console.error('[getBookingsForClass] unexpected:', err);
    return [];
  }
}

export async function getAllBookings(): Promise<Booking[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('*, classes(name), pack_purchases(id, amount_usd, status, code)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getAllBookings]', error.message);
      return [];
    }
    return (data as unknown as (BookingRow & { classes: { name: string } | null; pack_purchases: PackJoin })[]).map(rowToBooking);
  } catch (err) {
    console.error('[getAllBookings] unexpected:', err);
    return [];
  }
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<boolean> {
  try {
    const supabase = await createClient();

    if (status === 'cancelled') {
      // Get class_id first to release the spot
      const { data: booking } = await supabase
        .from('bookings')
        .select('class_id')
        .eq('id', id)
        .single();

      if (booking?.class_id) {
        await supabase.rpc('increment_spots', { p_class_id: booking.class_id });
      }
    }

    const { error } = await supabase
      .from('bookings')
      .update({ payment_status: status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[updateBookingStatus]', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[updateBookingStatus] unexpected:', err);
    return false;
  }
}
