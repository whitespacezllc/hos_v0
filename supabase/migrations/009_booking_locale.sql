-- ─────────────────────────────────────────────────────────────────────────────
-- 009 · The language a booking or pack was bought in
--
-- The confirmation and pack-code emails go out in the customer's language.
-- At checkout that language is known; when the admin later marks a cash or
-- Venmo payment as collected it is not — so it is stored with the row.
-- Defaults to English, which is what every existing row was.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CONSTRAINT booking_locale_check CHECK (locale IN ('en', 'es'));

ALTER TABLE pack_purchases
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CONSTRAINT pack_locale_check CHECK (locale IN ('en', 'es'));

-- ── Booking references carry the Costa Rica date ─────────────────────────────
-- `now()` is UTC on Supabase, so a booking made after 18:00 in Santa Teresa
-- used to be stamped with tomorrow's date.
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_date text;
  v_ref  text;
  v_exists boolean;
BEGIN
  v_date := to_char(now() AT TIME ZONE 'America/Costa_Rica', 'YYYYMMDD');
  LOOP
    v_ref := 'HOS-' || v_date || '-' ||
      upper(substring(md5(random()::text) from 1 for 4));
    SELECT EXISTS (
      SELECT 1 FROM bookings WHERE booking_reference = v_ref
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_ref;
END;
$$;

-- ── The browser key can only open a pending order ────────────────────────────
-- Every insert on the money path goes through the service role on the
-- server; these policies exist for the public key and used to let it write
-- any row at all — a pack marked paid, with a code and credits, included.
DROP POLICY IF EXISTS "pack_purchases_insert_public" ON pack_purchases;
CREATE POLICY "pack_purchases_insert_public"
  ON pack_purchases FOR INSERT
  WITH CHECK (status = 'pending' AND code IS NULL AND classes_used = 0);

DROP POLICY IF EXISTS "bookings_insert_public" ON bookings;
CREATE POLICY "bookings_insert_public"
  ON bookings FOR INSERT
  WITH CHECK (payment_status = 'pending');

-- ── Spending credits and spots is the server's job ───────────────────────────
-- These run with SECURITY DEFINER and were callable with the public key: a
-- pack code, once known, could be drained from the browser console.
REVOKE EXECUTE ON FUNCTION redeem_pack_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION decrement_spots(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_spots(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_pack_code(text) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_spots(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION increment_spots(uuid) TO service_role;
