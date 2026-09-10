import { computeOrderHash, consultOrder } from '@/lib/tilopay';

// ─── Was this payment real? ──────────────────────────────────────────────────
// The customer's browser brings the result back as a query string anyone can
// type. Before a spot is confirmed or a pack code is issued, the payment is
// checked the way Tilopay recommends — by asking Tilopay: POST /consult
// returns what was processed for the order, and it must be approved for the
// amount we charged.
//
// Outcomes:
//   verified  — Tilopay confirms an approved payment for the right amount
//   mismatch  — Tilopay knows the order but it is not approved, or not for
//               that amount: nothing is confirmed, nothing is released
//   unknown   — Tilopay could not be asked (network, credentials); the
//               OrderHash is tried as a fallback, and if it does not match
//               the order is held for the studio to check by hand
//
// TILOPAY_TRUST_CALLBACK=true skips all of this and believes the query
// string. Emergency use only, while something upstream is broken.

export type Verification =
  | { outcome: 'verified'; via: 'consult' | 'hash' | 'trust'; transactionId: string | null }
  | { outcome: 'mismatch'; reason: string }
  | { outcome: 'unknown'; reason: string };

export type CallbackParams = {
  order: string;
  code: string | null;
  auth: string | null;
  tx: string | null;
  receivedHash: string | null;
};

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
    const c = await consultOrder(p.order);
    if (c.found) {
      if (!c.approved) return { outcome: 'mismatch', reason: `tilopay says code ${c.code}: ${c.description}` };
      if (Math.abs(c.amount - expectedAmount) > 0.005) {
        return { outcome: 'mismatch', reason: `tilopay processed ${c.amount} ${c.currency}, expected ${expectedAmount} USD` };
      }
      return { outcome: 'verified', via: 'consult', transactionId: c.transactionId ?? p.tx };
    }
    // Tilopay has no transaction for this order: the "approval" came from nowhere.
    return { outcome: 'mismatch', reason: 'tilopay has no transaction for this order' };
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
  return { outcome: 'unknown', reason: 'consult unavailable and hash not verifiable' };
}

/**
 * For an order whose return never arrived: did the customer pay anyway?
 * Answers only when Tilopay could be asked; `null` means "could not tell".
 */
export async function orderWasPaid(
  order: string,
  expectedAmount: number,
): Promise<{ paid: boolean; transactionId: string | null } | null> {
  try {
    const c = await consultOrder(order);
    if (!c.found) return { paid: false, transactionId: null };
    const paid = c.approved && Math.abs(c.amount - Number(expectedAmount.toFixed(2))) < 0.005;
    return { paid, transactionId: c.transactionId };
  } catch (err) {
    console.error('[tilopay] consult unavailable (sweep)', order, err instanceof Error ? err.message : err);
    return null;
  }
}
