import { createServiceRoleClient } from '@/lib/supabase/service';

// ─── What the receipt pages read ─────────────────────────────────────────────
// The pages a customer lands on after paying (/booking/confirmacion,
// /paquetes/resultado) are public and addressed by the order's id — a uuid
// nobody can guess, unlike the short reference printed on the receipt. They
// show what the customer already knows — their class, their code — and
// nothing that identifies them beyond a first name.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BookingReceipt = {
  reference: string;
  firstName: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'no-show';
  paymentMethod: 'card' | 'cash' | 'venmo';
  totalUsd: number;
  classId: string;
  className: string;
  instructor: string | null;
  /** ISO instant. */
  startsAt: string;
  durationMinutes: number;
  location: string;
  /** Bought together with a pack — the code arrives by email. */
  withPack: boolean;
};

export async function getBookingReceipt(id: string): Promise<BookingReceipt | null> {
  if (!UUID.test(id)) return null;
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(
        'booking_reference, first_name, payment_status, payment_method, total_usd, class_id, pack_purchase_id, classes ( name, starts_at, duration_minutes, location, instructors ( name ) )',
      )
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as {
      booking_reference: string;
      first_name: string;
      payment_status: BookingReceipt['status'];
      payment_method: BookingReceipt['paymentMethod'];
      total_usd: number | null;
      class_id: string;
      pack_purchase_id: string | null;
      classes: {
        name: string;
        starts_at: string;
        duration_minutes: number;
        location: string;
        instructors: { name: string } | null;
      } | null;
    };
    if (!row.classes) return null;
    return {
      reference: row.booking_reference,
      firstName: row.first_name,
      status: row.payment_status,
      paymentMethod: row.payment_method ?? 'card',
      totalUsd: Number(row.total_usd ?? 0),
      classId: row.class_id,
      className: row.classes.name,
      instructor: row.classes.instructors?.name ?? null,
      startsAt: row.classes.starts_at,
      durationMinutes: row.classes.duration_minutes,
      location: row.classes.location,
      withPack: !!row.pack_purchase_id,
    };
  } catch (err) {
    console.error('[getBookingReceipt]', err);
    return null;
  }
}

export type PackReceipt = {
  status: 'pending' | 'paid' | 'cancelled';
  code: string | null;
  classesTotal: number;
  classesUsed: number;
  packName: string;
  firstName: string;
};

export async function getPackReceipt(id: string): Promise<PackReceipt | null> {
  if (!UUID.test(id)) return null;
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('pack_purchases')
      .select('status, code, classes_total, classes_used, first_name, class_packs ( name )')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as {
      status: PackReceipt['status'];
      code: string | null;
      classes_total: number;
      classes_used: number;
      first_name: string;
      class_packs: { name: string } | null;
    };
    return {
      status: row.status,
      code: row.code,
      classesTotal: row.classes_total,
      classesUsed: row.classes_used,
      packName: row.class_packs?.name ?? `Pack x${row.classes_total}`,
      firstName: row.first_name,
    };
  } catch (err) {
    console.error('[getPackReceipt]', err);
    return null;
  }
}
