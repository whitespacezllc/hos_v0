// ─────────────────────────────────────────────────────────────────────────────
// Tilopay (Costa Rica) — server-side helper for the class-pack checkout.
//
// Verified flow (hosted checkout):
//   1. POST /api/v1/login { apiuser, password, key } → { access_token } (JWT).
//   2. POST /api/v1/processPayment (Bearer) { redirect, key, amount, currency,
//      orderNumber, capture, billTo... } → { url } to a secure hosted page
//      (securepayment.tilopay.com). The customer enters their card THERE, so no
//      card data ever touches our site.
//   3. Tilopay redirects back to our `redirect` URL with the result params
//      (code=1 approved, order, transaction, hash…). Our callback confirms.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac } from 'crypto';

// Overridable so a local stand-in can play Tilopay during end-to-end tests;
// production never sets it.
const BASE_URL = process.env.TILOPAY_API_BASE?.replace(/\/+$/, '') || 'https://app.tilopay.com/api/v1';

// Recomputes the OrderHash Tilopay returns on the callback, per their
// WooCommerce plugin: HMAC-SHA256(http_build_query(params), "{tpt}|{key}|{pass}").
// Tilopay does not publish the algorithm (their docs say to ask sac@tilopay.com
// for it), so this is a best effort — `consultOrder` below is the check that
// counts, and this one only serves as a fallback when that call cannot be made.
export function computeOrderHash(p: {
  orderId: string; // tpt / tilopay-transaction
  externalOrderId: string; // our order number
  amount: string; // "1.00" (2 decimals)
  currency: string; // "USD"
  responseCode: string; // "1"
  auth: string;
  email: string;
}): string | null {
  const key = process.env.TILOPAY_API_KEY;
  const user = process.env.TILOPAY_API_USER;
  const pass = process.env.TILOPAY_API_PASSWORD;
  if (!key || !user || !pass) return null;

  const params = new URLSearchParams();
  params.append('api_Key', key);
  params.append('api_user', user);
  params.append('orderId', p.orderId);
  params.append('external_orden_id', p.externalOrderId);
  params.append('amount', p.amount);
  params.append('currency', p.currency);
  params.append('responseCode', p.responseCode);
  params.append('auth', p.auth);
  params.append('email', p.email);

  const hashKey = `${p.orderId}|${key}|${pass}`;
  return createHmac('sha256', hashKey).update(params.toString()).digest('hex');
}

function creds() {
  const apiuser = process.env.TILOPAY_API_USER;
  const password = process.env.TILOPAY_API_PASSWORD;
  const key = process.env.TILOPAY_API_KEY;
  if (!apiuser || !password || !key) {
    throw new Error('tilopay_not_configured');
  }
  return { apiuser, password, key };
}

// Step 1 — authenticate. Returns a short-lived Bearer access token.
export async function login(): Promise<string> {
  const { apiuser, password, key } = creds();
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiuser, password, key }),
    cache: 'no-store',
  });
  if (!res.ok) {
    // Capture Tilopay's error body so production logs reveal the real cause
    // (e.g. bad credentials) instead of just an HTTP status.
    const body = await res.text().catch(() => '');
    console.error('[tilopay.login] failed', res.status, body.slice(0, 500));
    throw new Error(`tilopay_login_failed_${res.status}`);
  }
  const data = await res.json();
  if (!data.access_token) {
    console.error('[tilopay.login] no access_token in response', JSON.stringify(data).slice(0, 500));
    throw new Error('tilopay_login_no_token');
  }
  return data.access_token as string;
}

export type CreatePaymentParams = {
  amount: string; // "12.00"
  currency: string; // "USD"
  orderNumber: string; // unique, non-repeating
  redirect: string; // absolute callback URL
  billToFirstName: string;
  billToLastName: string;
  billToEmail: string;
  billToTelephone?: string;
  billToCountry?: string; // ISO-2, e.g. "CR"
  billToAddress?: string;
  billToCity?: string;
  capture?: '0' | '1'; // 1 = capture (charge) now
};

// Step 2 — create a hosted payment session. Returns the URL to redirect to.
export async function createPayment(params: CreatePaymentParams): Promise<string> {
  const { key } = creds();
  const accessToken = await login();

  const res = await fetch(`${BASE_URL}/processPayment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      key,
      redirect: params.redirect,
      amount: params.amount,
      currency: params.currency,
      orderNumber: params.orderNumber,
      capture: params.capture ?? '1',
      subscription: '0',
      billToFirstName: params.billToFirstName,
      billToLastName: params.billToLastName,
      billToEmail: params.billToEmail,
      billToTelephone: params.billToTelephone ?? '',
      billToCountry: params.billToCountry ?? 'CR',
      billToAddress: params.billToAddress ?? '',
      billToCity: params.billToCity ?? '',
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[tilopay.processPayment] failed', res.status, body.slice(0, 500));
    throw new Error(`tilopay_process_failed_${res.status}`);
  }
  const data = await res.json();
  if (!data.url) {
    // Tilopay can answer 200 with an error payload (e.g. invalid amount) and no
    // url. Log it so the failure is diagnosable from server logs.
    console.error('[tilopay.processPayment] no url in response', JSON.stringify(data).slice(0, 500));
    throw new Error('tilopay_process_no_url');
  }
  return data.url as string;
}

// ─── Step 3 — ask Tilopay what really happened to an order ───────────────────
// POST /consult returns the transaction recorded for an orderNumber, with its
// approval code and the amount that was actually processed. Tilopay's own
// guidance: "confirm the status against the API before dispatching or
// releasing a service". This is what the callback (and the stale-hold sweep)
// trust, instead of the query string the customer's browser carried back.
export type ConsultResult =
  | { found: false }
  | {
      found: true;
      approved: boolean;
      /** What Tilopay processed, in the transaction's currency. */
      amount: number;
      currency: string;
      code: string;
      description: string;
      transactionId: string | null;
    };

type ConsultRow = {
  id_tilopay?: number | string;
  orderNumber?: string;
  amount?: string | number;
  currency?: string;
  code?: string | number;
  response?: string;
};

export async function consultOrder(orderNumber: string): Promise<ConsultResult> {
  const { key } = creds();
  const accessToken = await login();

  const res = await fetch(`${BASE_URL}/consult`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ key, orderNumber, merchantId: '' }),
    cache: 'no-store',
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    console.error('[tilopay.consult] failed', res.status, text.slice(0, 500));
    throw new Error(`tilopay_consult_failed_${res.status}`);
  }
  let data: { type?: string | number; message?: string; response?: ConsultRow[] | string };
  try {
    data = JSON.parse(text);
  } catch {
    console.error('[tilopay.consult] not json', text.slice(0, 300));
    throw new Error('tilopay_consult_not_json');
  }
  // The docs warn that `response` sometimes arrives as a JSON string.
  let rows = data.response;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows) as ConsultRow[];
    } catch {
      rows = [];
    }
  }
  if (String(data.type) !== '200' || !Array.isArray(rows) || rows.length === 0) {
    console.log('[tilopay.consult] no transaction for order', orderNumber, String(data.type), data.message ?? '');
    return { found: false };
  }
  // One orderNumber is one transaction; take the first matching row.
  const row = rows.find((r) => String(r.orderNumber ?? '') === orderNumber) ?? rows[0];
  const code = String(row.code ?? '');
  return {
    found: true,
    approved: code === '1',
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'USD'),
    code,
    description: String(row.response ?? ''),
    transactionId: row.id_tilopay != null ? String(row.id_tilopay) : null,
  };
}
