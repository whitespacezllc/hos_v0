import { NextRequest, NextResponse } from 'next/server';
import { siteOrigin } from '@/lib/site-url';
import { localizedPath } from '@/lib/seo';
import { verifyApprovedPayment, type Verification } from '@/lib/checkout/verify';
import {
  confirmBookingPaid,
  confirmPackPurchase,
  holdOrderForReview,
  localeOf,
  releaseOrder,
  service,
} from '@/lib/checkout/core';

// Tilopay redirects the customer here after the hosted payment completes.
// code=1 means approved. The `order` is either a pack_purchases id (pack bought
// from /paquetes or from the booking flow) or a bookings id (drop-in).
//
// This is a GET the customer's browser performs, so it can be replayed or
// forged by anyone who has seen it. Nothing here is believed on its own:
//   · an approved result is verified against Tilopay's API before anything is
//     confirmed (lib/checkout/verify.ts). Verified → confirmed, even if the
//     order had been cancelled in the meantime (the customer paid). Not
//     approved per Tilopay → released like a declined return. Unknown to
//     Tilopay → nothing changes; the stale-hold sweep asks again later. Not
//     verifiable, or approved for another amount → held for the studio;
//   · a declined result only ever releases an order that is still pending, so
//     a replay cannot undo a payment that went through.
export const dynamic = 'force-dynamic';

type Settled = 'ok' | 'declined' | 'review' | 'error';

// What the receipt says, for an approved return whose verification came back
// as `v`, once the order is still (or again) unpaid.
function afterVerification(v: Exclude<Verification, { outcome: 'verified' }>, wasCancelled: boolean): Settled {
  if (v.outcome === 'not_approved') return 'declined';
  if (v.outcome === 'not_found' && !wasCancelled) return 'review';
  return 'review';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const auth = searchParams.get('auth');
  const tx = searchParams.get('tilopay-transaction') ?? searchParams.get('tpt');
  const receivedHash = searchParams.get('OrderHash');
  const order =
    searchParams.get('order') ??
    searchParams.get('orderNumber') ??
    searchParams.get('ordernumber');
  // What reconciliation needs, and nothing personal.
  console.log('[tilopay/callback]', { code, order, tx, description: searchParams.get('description') });

  const site = siteOrigin();
  const approved = code === '1';
  const errorPage = () => NextResponse.redirect(`${site}/paquetes/resultado?status=error`);
  if (!order) return errorPage();

  const supabase = service();
  const params = { order, code, auth, tx, receivedHash };

  // ── A pack purchase? ────────────────────────────────────────────────────────
  const { data: pack } = await supabase.from('pack_purchases').select('*').eq('id', order).maybeSingle();

  if (pack) {
    const locale = localeOf((pack as { locale?: string }).locale);
    const receipt = (status: Settled) =>
      NextResponse.redirect(
        `${site}${localizedPath('/paquetes/resultado', locale)}?status=${status}&kind=pack&order=${order}`,
      );

    if (!approved) {
      await releaseOrder('pack', order);
      return receipt('declined');
    }
    if (pack.status === 'paid') return receipt('ok');

    // A pack bought from the booking flow was charged with that class's extras.
    const { data: linked } = await supabase
      .from('bookings')
      .select('total_usd')
      .eq('pack_purchase_id', order)
      .maybeSingle();
    const charged = Number(pack.amount_usd ?? 0) + Number(linked?.total_usd ?? 0);

    const v = await verifyApprovedPayment(params, { amount: charged, email: pack.email });
    if (v.outcome === 'verified') {
      const res = await confirmPackPurchase(order, v.transactionId);
      if (!res.ok) {
        console.error('[tilopay/callback] pack confirmation failed', order, res.error);
        return receipt('error');
      }
      return receipt('ok');
    }
    console.error('[tilopay/callback] pack payment not verified', order, v);
    if (v.outcome === 'not_approved') await releaseOrder('pack', order);
    else if (v.outcome !== 'not_found' || pack.status === 'cancelled') await holdOrderForReview('pack', order, v.transactionId, v.reason);
    return receipt(afterVerification(v, pack.status === 'cancelled'));
  }

  // ── Otherwise a drop-in booking ─────────────────────────────────────────────
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', order).maybeSingle();

  if (booking) {
    const locale = localeOf((booking as { locale?: string }).locale);
    const receipt = (status: Settled) =>
      NextResponse.redirect(
        `${site}${localizedPath('/booking/confirmacion', locale)}?order=${order}&status=${status}`,
      );

    if (!approved) {
      await releaseOrder('booking', order);
      return receipt('declined');
    }
    if (booking.payment_status === 'confirmed') return receipt('ok');

    const v = await verifyApprovedPayment(params, { amount: Number(booking.total_usd ?? 0), email: booking.email });
    if (v.outcome === 'verified') {
      const res = await confirmBookingPaid(order, v.transactionId);
      return receipt(res === 'not_found' ? 'error' : 'ok');
    }
    console.error('[tilopay/callback] booking payment not verified', order, v);
    const wasCancelled = booking.payment_status === 'cancelled';
    if (v.outcome === 'not_approved') await releaseOrder('booking', order);
    else if (v.outcome !== 'not_found' || wasCancelled) await holdOrderForReview('booking', order, v.transactionId, v.reason);
    return receipt(afterVerification(v, wasCancelled));
  }

  console.error('[tilopay/callback] order not found:', order);
  return errorPage();
}
