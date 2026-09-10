import { hasLocale } from 'next-intl';
import { format } from 'date-fns';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { routing, type AppLocale } from '@/i18n/routing';
import { inCostaRica } from '@/lib/costa-rica-time';
import { paymentMethodLabel } from '@/lib/payment-methods';
import {
  sendAdminNotification,
  sendBookingEmail,
  type BookingEmailData,
  type BookingEvent,
} from '@/lib/email';

// ─── From a booking id to the emails it deserves ─────────────────────────────
// Reads everything the customer's email needs (the class, its instructor, the
// extras, the pack behind a code) and sends it, plus the studio's heads-up when
// one is configured. Never throws: a booking must not fail because email did.
//
// Uses the session-less service client on purpose. This runs from the public
// checkout, from the Tilopay callback and from the admin panel; the cookie-
// bound service client would carry the admin's own session in the last case,
// and the customer's data is read the same way in all three.

type BookingRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  booking_reference: string;
  payment_method: 'card' | 'cash' | 'venmo';
  payment_status: string;
  referral_code: string | null;
  pack_purchase_id: string | null;
  upsell_ids: string[] | null;
  total_usd: number | null;
  locale?: string | null;
  classes: {
    name: string;
    starts_at: string;
    duration_minutes: number;
    location: string;
    price_dropin_usd: number;
    instructors: { name: string } | null;
  } | null;
  pack_purchases: { code: string | null; class_packs: { name: string } | null } | null;
};

function localeOf(row: BookingRow): AppLocale {
  return hasLocale(routing.locales, row.locale) ? row.locale : routing.defaultLocale;
}

export async function loadBookingEmailData(
  bookingId: string,
  event: BookingEvent,
  extra: { creditReturned?: boolean } = {},
): Promise<BookingEmailData | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, first_name, last_name, email, booking_reference, payment_method, payment_status,
       referral_code, pack_purchase_id, upsell_ids, total_usd, locale,
       classes ( name, starts_at, duration_minutes, location, price_dropin_usd, instructors ( name ) ),
       pack_purchases ( code, class_packs ( name ) )`,
    )
    .eq('id', bookingId)
    .single();
  if (error || !data) {
    console.error('[booking-notify] booking not found', bookingId, error?.message);
    return null;
  }
  const row = data as unknown as BookingRow;
  if (!row.classes) {
    console.error('[booking-notify] booking without class', bookingId);
    return null;
  }

  const upsellIds = row.upsell_ids ?? [];
  let extras: { name: string; priceUsd: number }[] = [];
  if (upsellIds.length > 0) {
    const { data: ups } = await supabase.from('upsells').select('id, name, price_usd').in('id', upsellIds);
    // Keep the order the customer picked them in.
    extras = upsellIds
      .map((id) => (ups ?? []).find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map((u) => ({ name: u.name, priceUsd: Number(u.price_usd) }));
  }

  // What covers the class: a pack bought with it, a pack code, or nothing.
  let coveredBy: BookingEmailData['coveredBy'] = 'none';
  let packName: string | null = null;
  const code = row.referral_code?.trim() || null;
  if (row.pack_purchase_id) {
    coveredBy = 'pack_purchase';
    packName = row.pack_purchases?.class_packs?.name ?? null;
  } else if (code && code.startsWith('PACK-')) {
    const { data: pack } = await supabase
      .from('pack_purchases')
      .select('code, class_packs ( name )')
      .eq('code', code)
      .maybeSingle();
    if (pack) {
      coveredBy = 'pack_code';
      packName = (pack as unknown as { class_packs: { name: string } | null }).class_packs?.name ?? null;
    }
  }

  return {
    event,
    to: row.email,
    firstName: row.first_name,
    reference: row.booking_reference,
    className: row.classes.name,
    instructor: row.classes.instructors?.name ?? null,
    startsAt: row.classes.starts_at,
    durationMinutes: row.classes.duration_minutes,
    location: row.classes.location,
    classPriceUsd: Number(row.classes.price_dropin_usd),
    extras,
    totalUsd: Number(row.total_usd ?? 0),
    paymentMethod: row.payment_method ?? 'card',
    coveredBy,
    code,
    packName,
    creditReturned: extra.creditReturned,
    locale: localeOf(row),
  };
}

/** Emails the customer about their booking, and the studio when configured. */
export async function notifyBooking(
  bookingId: string,
  event: BookingEvent,
  extra: { creditReturned?: boolean } = {},
): Promise<void> {
  try {
    const d = await loadBookingEmailData(bookingId, event, extra);
    if (!d) return;
    await sendBookingEmail(d);

    if (event === 'confirmed' || event === 'pending') {
      const when = format(inCostaRica(d.startsAt), 'EEE MMM d · HH:mm');
      await sendAdminNotification({
        kind: 'booking',
        status: event === 'pending' ? 'pending' : 'confirmed',
        customerName: `${d.firstName}`,
        customerEmail: d.to,
        summary: `${d.className} · ${when}`,
        details: [
          `Reference: ${d.reference}`,
          `Class: ${d.className} · ${when} (Costa Rica)`,
          `Payment: ${paymentMethodLabel(d.paymentMethod)} · ${event === 'pending' ? 'to collect' : 'paid'}`,
          `Total: $${d.totalUsd} USD`,
          d.packName ? `Pack: ${d.packName}` : '',
          d.code ? `Code: ${d.code}` : '',
        ].filter(Boolean),
        adminPath: `/admin/reservas?q=${encodeURIComponent(d.reference)}`,
      });
    }
  } catch (err) {
    console.error('[booking-notify]', event, bookingId, err);
  }
}
