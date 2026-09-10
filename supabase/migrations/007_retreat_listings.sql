-- ─────────────────────────────────────────────────────────────────────────────
-- 007 · Retreat listings
--
-- The retreats shown on /upcoming-retreats used to be hardcoded in the message
-- catalogue. This table lets the admin manage them: photo, label, name, who
-- runs it, dates, a brief description and the link the "More info" button
-- opens (a website, a WhatsApp link or a page on this site).
--
-- Nothing here touches the booking side. The public page reads the published
-- rows and splits them itself: a retreat whose end date is behind today's
-- date in Costa Rica moves to "Past Retreats" on its own — nothing to do in
-- the panel when a retreat ends.
--
-- Photographs go to a public Storage bucket of their own ('retreat-images');
-- the row only keeps the public URL, which may also be a path under /images
-- for the ones seeded from the site's own bank.
--
-- Safe to run again: every statement is guarded, and the seed only fills an
-- empty table, so whatever the admin has since renamed, edited or deleted
-- stays as they left it.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retreat_listings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text        NOT NULL,
  label          text        NOT NULL,              -- "Wellness Retreat"
  instructors    text        NOT NULL,              -- "Elly Miles" · free text, one or several
  starts_on      date        NOT NULL,
  ends_on        date        NOT NULL,
  description    text        NOT NULL,              -- brief, capped so the cards stay even
  url            text        NOT NULL,              -- https://…, wa.me/…, or /a-page-on-this-site
  image_url      text,                              -- public URL; NULL falls back to a house photo
  image_alt      text,                              -- hand-written for the seeded photos; cleared when the photo changes
  image_alt_es   text,
  label_es       text,                              -- optional Spanish versions; NULL reuses English
  description_es text,
  is_published   boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retreat_listings_dates_in_order     CHECK (ends_on >= starts_on),
  CONSTRAINT retreat_listings_description_brief  CHECK (char_length(description) <= 260),
  CONSTRAINT retreat_listings_description_es_brief
    CHECK (description_es IS NULL OR char_length(description_es) <= 260)
);

-- For a database that ran an earlier cut of this file.
ALTER TABLE retreat_listings ADD COLUMN IF NOT EXISTS image_alt_es text;

CREATE INDEX IF NOT EXISTS retreat_listings_starts_on_idx ON retreat_listings (starts_on);
CREATE INDEX IF NOT EXISTS retreat_listings_ends_on_idx   ON retreat_listings (ends_on);

-- updated_at follows every change, so the panel can show "last edited".
CREATE OR REPLACE FUNCTION retreat_listings_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS retreat_listings_touch_updated_at ON retreat_listings;
CREATE TRIGGER retreat_listings_touch_updated_at
  BEFORE UPDATE ON retreat_listings
  FOR EACH ROW EXECUTE FUNCTION retreat_listings_touch_updated_at();

-- ── 2. Privileges and row level security ─────────────────────────────────────
-- Hosted Supabase grants these to new tables through default privileges;
-- spelled out here so the table behaves the same wherever the file is run
-- (a fresh local stack applied through psql has no such defaults). The
-- policies below decide which rows each role can see or touch: visitors read
-- what is published; the admin reads everything and is the only one who
-- writes. (The panel writes through the service role, which bypasses RLS —
-- the policies are the floor, not the door.)
GRANT SELECT ON retreat_listings TO anon, authenticated;
GRANT ALL ON retreat_listings TO service_role;

ALTER TABLE retreat_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retreat_listings_select_published" ON retreat_listings;
CREATE POLICY "retreat_listings_select_published"
  ON retreat_listings FOR SELECT USING (is_published OR is_admin());
DROP POLICY IF EXISTS "retreat_listings_insert_admin" ON retreat_listings;
CREATE POLICY "retreat_listings_insert_admin"
  ON retreat_listings FOR INSERT WITH CHECK (is_admin());
DROP POLICY IF EXISTS "retreat_listings_update_admin" ON retreat_listings;
CREATE POLICY "retreat_listings_update_admin"
  ON retreat_listings FOR UPDATE USING (is_admin());
DROP POLICY IF EXISTS "retreat_listings_delete_admin" ON retreat_listings;
CREATE POLICY "retreat_listings_delete_admin"
  ON retreat_listings FOR DELETE USING (is_admin());

-- ── 3. Public Storage bucket for the photographs ─────────────────────────────
-- The bucket itself refuses anything that is not an image or is over 5 MB —
-- the same limits the upload action checks, kept here too so they hold even
-- for a file that reaches Storage some other way.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'retreat-images', 'retreat-images', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read of the objects; uploads happen server-side with the service
-- role, so no write policy is needed (same arrangement as class-images).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read retreat-images'
  ) THEN
    CREATE POLICY "Public read retreat-images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'retreat-images');
  END IF;
END $$;

-- ── 4. Seed: the four retreats the page carried hardcoded ───────────────────
-- Only into an empty table: once the panel has been used, running the file
-- again inserts nothing, so a retreat the admin renamed, edited or deleted
-- stays as they left it. The ids are fixed to match the fallback copy in
-- lib/retreat-listings.ts (for a deploy that outruns this migration) — keep
-- both copies in step.
INSERT INTO retreat_listings
  (id, title, label, instructors, starts_on, ends_on, description, url, image_url, image_alt, image_alt_es, label_es, description_es)
SELECT v.*
FROM (VALUES
  (
    '00000000-0000-4000-8000-000000000001'::uuid,
    'Sol for Soul',
    'Wellness Retreat',
    'Elly Miles',
    DATE '2026-09-06', DATE '2026-09-12',
    'A portal into yourself, held in a container that feels light, supportive and fun — built around the way Santa Teresa naturally invites you to open up and come alive.',
    'https://www.ellymiles.com/costaricaseptember',
    '/images/upcoming/sol-for-soul.jpg',
    'A guest stepping out into the morning at House of Shakti',
    'Una huésped saliendo a la mañana en House of Shakti',
    'Retiro de bienestar',
    'Un portal hacia ti, sostenido en un contenedor ligero, acompañado y divertido, construido alrededor de la manera en que Santa Teresa te invita naturalmente a abrirte y sentirte con vida.'
  ),
  (
    '00000000-0000-4000-8000-000000000002'::uuid,
    'The Awakened Body: A Tantric Yoga Intensive',
    'Yoga Teacher Training',
    'Nancy Goodfellow',
    DATE '2026-11-21', DATE '2026-12-04',
    'A transformational immersion for those who wish to deepen their relationship with yoga beyond the physical practice. One hundred hours on the embodied path of Tantra — movement, breath, ritual and self-inquiry.',
    '/yoga-teacher-training',
    '/images/introduction/ytt-introduction-07.webp',
    'A group practising together in the open shala',
    'Un grupo practicando junto en la shala abierta',
    'Yoga Teacher Training',
    'Una inmersión transformadora para quienes desean profundizar su relación con el yoga más allá de la práctica física. Cien horas en el camino encarnado del Tantra: movimiento, respiración, ritual e indagación interior.'
  ),
  (
    '00000000-0000-4000-8000-000000000003'::uuid,
    'NOURISH: 50hr Restorative + Yin Training',
    'Yoga Training',
    'Sam Bianchini',
    DATE '2026-12-05', DATE '2026-12-12',
    'A week-long retreat paired with a rich, life-affirming study of Restorative and Yin Yoga — and how to hold healing space in your own original medicine.',
    'https://sambianchini.com/retreats',
    '/images/upcoming/nourish.webp',
    'A group resting through a restorative practice in the shala',
    'Un grupo descansando en una práctica restaurativa en la shala',
    'Formación de yoga',
    'Un retiro de una semana unido a un estudio rico y vital del Yoga Restaurativo y el Yin, y de cómo sostener un espacio de sanación desde tu propia medicina original.'
  ),
  (
    '00000000-0000-4000-8000-000000000004'::uuid,
    'SALVAJE',
    'Transformational Retreat',
    'Heather Nil',
    DATE '2027-01-18', DATE '2027-01-23',
    'More than a retreat — an awakening. For anyone seeking an experience to shake their world and bring their HELL YES energy back.',
    'https://www.canva.com/design/DAGlZEo1TOg/gc1GnLBciOIDxuLj6lhZVA/watch',
    '/images/retreats/retreats-7.webp',
    'Bathing at the waterfall',
    'Baño en la cascada',
    'Retiro transformacional',
    'Más que un retiro: un despertar. Para quien busca una experiencia que sacuda su mundo y le devuelva la energía del HELL YES.'
  )
) AS v(id, title, label, instructors, starts_on, ends_on, description, url, image_url, image_alt, image_alt_es, label_es, description_es)
WHERE NOT EXISTS (SELECT 1 FROM retreat_listings)
ON CONFLICT (id) DO NOTHING;
