import { computeOrderHash, consultOrder, type ConsultResult } from '@/lib/tilopay';

// ─── Was this payment real? ──────────────────────────────────────────────────
// The customer's browser brings the result back as a query string anyone can
// type. Before a spot is confirmed or a pack code is issued, the payment is
// checked the way Tilopay recommends — by asking Tilopay: POST /consult
// returns what was processed for the order, and it must be approved for the
// amount we charged.
//
// Outcomes:
//   verified        — Tilopay confirms an approved payment for the right amount
//   not_approved    — Tilopay knows the order and says it was not approved:
//                     the "approval" on the query string was not Tilopay's
//   not_found       — Tilopay has no transaction for the order (a forged
//                     return, or one that arrived before Tilopay indexed it):
//                     nothing is confirmed, nothing is released, the
//                     stale-hold sweep asks again later
//   amount_mismatch — approved, but not for what we charged: a human decides
//   unknown         — Tilopay could not be asked (network, credentials); the
//                     OrderHash is tried as a fallback, and if it does not
//                     match the order is held for the studio to check by hand
//
// TILOPAY_TRUST_CALLBACK=true skips all of this and believes the query
// string. Emergency use only, while something upstream is broken.

export type Verification =
  | { outcome: 'verified'; via: 'consult' | 'hash' | 'trust'; transactionId: string | null }
  | { outcome: 'not_approved' | 'not_found' | 'amount_mismatch' | 'unknown'; reason: string; transactionId: string | null };

export type CallbackParams = {
  order: string;
  code: string | null;
  auth: string | null;
  tx: string | null;
  receivedHash: string | null;
};

const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.005;

// A return can beat Tilopay's own index by a moment: one short second look.
async function consultTwice(order: string): Promise<ConsultResult> {
  const first = await consultOrder(order);
  if (first.found) return first;
  await new Promise((r) => setTimeout(r, 1500));
  return consultOrder(order);
}

export async function verifyApprovedPayment(
  p: CallbackParams,
  expected: { amount: number; email: string },
): Promise<Verification> {
  if (process.env.TILOPAY_TRUST_CALLBACK === 'true') {
    console.warn('[tilopay] TILOPAY_TRUST_CALLBACK is on — confirming without verification', p.order);
    return { outcome: 'verified', via: 'trust', transactionId: p.tx };
  }

  const expectedAmount = Number(expected.amount.toFixed(2));
  try {
    const c = await consultTwice(p.order);
    if (c.found) {
      if (!c.approved) return { outcome: 'not_approved', reason: `tilopay says code ${c.code}: ${c.description}`, transactionId: c.transactionId };
      if (!sameAmount(c.amount, expectedAmount)) {
        return { outcome: 'amount_mismatch', reason: `tilopay processed ${c.amount} ${c.currency}, expected ${expectedAmount} USD`, transactionId: c.transactionId };
      }
      return { outcome: 'verified', via: 'consult', transactionId: c.transactionId ?? p.tx };
    }
    return { outcome: 'not_found', reason: 'tilopay has no transaction for this order', transactionId: p.tx };
  } catch (err) {
    console.error('[tilopay] consult unavailable', p.order, err instanceof Error ? err.message : err);
  }

  // Fallback: the signature on the query string, if the formula holds.
  if (p.receivedHash && p.tx) {
    const computed = computeOrderHash({
      orderId: p.tx,
      externalOrderId: p.order,
      amount: expectedAmount.toFixed(2),
      currency: 'USD',
      responseCode: p.code ?? '',
      auth: p.auth ?? '',
      email: expected.email,
    });
    const ok = !!computed && computed === p.receivedHash;
    console.log('[tilopay] hash fallback', { order: p.order, ok });
    if (ok) return { outcome: 'verified', via: 'hash', transactionId: p.tx };
  }
  return { outcome: 'unknown', reason: 'consult unavailable and hash not verifiable', transactionId: p.tx };
}

export type SweepAnswer =
  | { outcome: 'paid'; transactionId: string | null }
  | { outcome: 'not_found' | 'not_approved'; transactionId: string | null }
  | { outcome: 'amount_mismatch'; transactionId: string | null; reason: string };

/**
 * For an order whose return never arrived: what happened to it? `null` means
 * Tilopay could not be asked — leave the order alone until it can.
 */
export async function consultForSweep(order: string, expectedAmount: number): Promise<SweepAnswer | null> {
  try {
    const c = await consultOrder(order);
    if (!c.found) return { outcome: 'not_found', transactionId: null };
    if (!c.approved) return { outcome: 'not_approved', transactionId: c.transactionId };
    if (!sameAmount(c.amount, Number(expectedAmount.toFixed(2)))) {
      return { outcome: 'amount_mismatch', transactionId: c.transactionId, reason: `tilopay processed ${c.amount} ${c.currency}, expected ${expectedAmount.toFixed(2)} USD` };
    }
    return { outcome: 'paid', transactionId: c.transactionId };
  } catch (err) {
    console.error('[tilopay] consult unavailable (sweep)', order, err instanceof Error ? err.message : err);
    return null;
  }
}
