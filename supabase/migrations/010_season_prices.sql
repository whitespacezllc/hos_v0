-- ─────────────────────────────────────────────────────────────────────────────
-- House of Shakti — Prices from November 2026, and the x20 pack retired
--
--   Drop-in   25 USD
--   Pack x5   85 USD
--   Pack x10 130 USD
--   Pack x20  off sale
--
-- From here on the studio changes these itself: Admin panel → Packs → Edit prices.
--
-- The x20 is retired, not deleted: pack purchases point at its row, and the
-- codes already sold keep working until their classes are spent.
--
-- Run it once, when this goes live. Running it twice in a row changes nothing,
-- but later on it would overwrite whatever the studio has set in the panel.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

UPDATE class_packs SET is_active = false WHERE classes_count = 20;
UPDATE class_packs SET price_usd = 85  WHERE classes_count = 5;
UPDATE class_packs SET price_usd = 130 WHERE classes_count = 10;

-- The drop-in row now means something: it is the standard price of one class.
INSERT INTO class_packs (name, classes_count, price_usd)
SELECT 'Drop-in', 1, 25.00
WHERE NOT EXISTS (SELECT 1 FROM class_packs WHERE classes_count = 1);
UPDATE class_packs SET price_usd = 25, is_active = true WHERE classes_count = 1;

-- Each class carries its own price. Those at the old standard move to the new
-- one; a class priced apart (a free meditation, a special workshop) keeps its
-- own. Past sessions stay as they were, and so does every booking: a booking
-- stores what it was sold at.
UPDATE class_templates SET price_dropin_usd = 25 WHERE price_dropin_usd = 20;
UPDATE classes SET price_dropin_usd = 25 WHERE price_dropin_usd = 20 AND starts_at >= now();

COMMIT;
