'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePrefersReducedMotion } from '@/hooks/use-media-query';
import { usePathname } from '@/i18n/navigation';
import { whatsappUrl } from '@/lib/whatsapp';

// ─── Floating WhatsApp button ────────────────────────────────────────────────
// The standing way to reach the house, pinned bottom-right on every public
// page. Carried over from the YTT landing (theawakenedbody) with one change of
// shape: there the tile was a single conversation, here it opens onto three —
// the same number behind all of them, but each door pre-writes a different
// opening line, so the team knows which question is walking in before reading
// a word of it.

// When the tile appears. Measured against the viewport rather than the page,
// so it clears the hero on a phone and a desktop alike. Pages too short to
// ever reach the threshold — a 404, a confirmation card — show it right away:
// a contact button that can never appear is worse than one with no hero to
// clear.
const APPEAR_AFTER_VIEWPORTS = 0.8;

// When the label unfurls, as a fraction of the page. By a third of the way
// down a reader is past the introduction and into the substance — far enough
// in to have formed a question, early enough that there is still page left to
// act on it.
const REVEAL_AT = 0.33;

// How long it stays open before folding back to the mark. Long enough to read
// twice over; short enough that it is gone before it becomes furniture.
const DWELL_MS = 4800;

// The button is for guests. Inside the admin panel, the instructor portal,
// the login screen and the booking flow it would be furniture at best and, in
// a checkout, a distraction floating over the payment form. (The admin and
// the portal have their own document now and never mount this; the prefixes
// stay so the list still reads as the full rule.) Compared against the
// locale-less pathname, so `/es/booking/…` is excluded like `/booking/…`.
const EXCLUDED_PREFIXES = ['/admin', '/instructor', '/login', '/forgot-password', '/set-password', '/booking'];

// ─── The three doors ─────────────────────────────────────────────────────────
// Same conversation, three prepared opening lines. The message is the routing:
// nothing else distinguishes the doors on the team's side, and since every
// page now shares one number (see lib/whatsapp.ts) that is true site-wide.
// Title, detail and opening line of each live in the catalogue under
// whatsapp.doors, in the reader's language.
const DOORS = ['stays', 'wellbeing', 'host'] as const;

// Whether the tile is currently over a band tagged `data-surface="dark"`.
// Vertical position is tested at the tile's midpoint so the swap happens
// exactly as it crosses an edge; horizontally the surface must overlap the
// tile's own extent — several tagged bands live inside the 80% container or
// are single cards in a grid, and on desktop the tile floats to the right of
// them, still on cream.
function isTileOverDark(tile: HTMLElement): boolean {
  const box = tile.getBoundingClientRect();
  const midY = box.top + box.height / 2;
  const surfaces = document.querySelectorAll('[data-surface="dark"]');
  for (const surface of surfaces) {
    const r = surface.getBoundingClientRect();
    if (r.top <= midY && r.bottom >= midY && r.left <= box.right && r.right >= box.left) {
      return true;
    }
  }
  return false;
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-[22px] w-[22px]">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

/**
 * Square, not the usual round bubble: the brand rule sets every button to
 * square corners, and WhatsApp's own green over this palette would be a blot
 * on an otherwise quiet page. The mark alone still reads.
 *
 * The label unfurls once, on its own, a third of the way down, then folds
 * back. A pill left permanently open is a banner — it covers the page on a
 * phone and stops being read within seconds. Pointing at the tile opens it
 * again, so the invitation is always one gesture away rather than always in
 * the way.
 *
 * A click opens the three doors as a small panel above the tile. The panel
 * stays warm-white on every surface — over a dark band it reads by contrast,
 * over the cream page its hairline border and shadow carry it — while the
 * tile itself inverts against whatever is underneath, exactly as on the YTT
 * landing.
 */
export function WhatsAppButton() {
  const t = useTranslations('whatsapp');
  const pathname = usePathname();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const tileRef = useRef<HTMLButtonElement | null>(null);
  const [past, setPast] = useState(false);
  const [onDark, setOnDark] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const reducedMotion = usePrefersReducedMotion();

  const syncSurface = useCallback(() => {
    const tile = tileRef.current;
    if (tile) setOnDark(isTileOverDark(tile));
  }, []);

  useEffect(() => {
    let ticking = false;
    let done = false;

    const measure = () => {
      ticking = false;
      const doc = document.documentElement;

      // Pages with nothing to scroll show the tile immediately — scrollY can
      // never clear any positive threshold there. Everywhere else the
      // threshold is the viewport rule, capped at half the page's real range
      // so short-but-scrollable pages don't demand most of their own length.
      const max = doc.scrollHeight - doc.clientHeight;
      setPast(
        max <= 1
          ? true
          : window.scrollY > Math.min(window.innerHeight * APPEAR_AFTER_VIEWPORTS, max * 0.5),
      );

      // What is underneath right now — see isTileOverDark. Over a dark band a
      // dark tile disappears, so it swaps to cream.
      syncSurface();

      if (done) return;
      if (max > 0 && window.scrollY / max >= REVEAL_AT) {
        done = true;
        setRevealed(true);
        window.setTimeout(() => setRevealed(false), DWELL_MS);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [syncSurface]);

  // The pass that first sets `past` runs before the tile has rendered, so its
  // surface check reads a null ref and stays stale — visible after a reload
  // with restored scroll, where no further scroll event ever comes. Re-measure
  // once the tile actually exists.
  useEffect(() => {
    if (past) syncSurface();
  }, [past, syncSurface]);

  // The panel must not outlive the tile: scroll back to the top with it open
  // and the tile unmounts, taking the outside-click closer's target with it —
  // reappearing later with a panel already open, unprompted.
  useEffect(() => {
    if (!past) setMenuOpen(false);
  }, [past]);

  // Escape closes the panel and hands focus back to the tile — without the
  // hand-back, focus dies on an element that just left the tree.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // A modal on top of the page claims Escape for itself in the capture
      // phase; one press should close what the reader is looking at, not
      // everything that happens to be open underneath it.
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        setMenuOpen(false);
        tileRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // A click anywhere else closes it. Listening on pointerdown rather than
  // click means a drag that starts outside also counts as leaving.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  // Guests only — see EXCLUDED_PREFIXES. Decided after every hook so the hook
  // order never varies between renders.
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  // The label competes with the panel for the same corner, so an open panel
  // wins and the label waits. The ambient reveal also stands down under
  // prefers-reduced-motion — with durations zeroed it would be a hard snap
  // open and shut, exactly the unasked-for motion that setting refuses.
  // Hover and focus still open it: those are answers, not ambience.
  const labelOpen = !menuOpen && ((revealed && !reducedMotion) || hovered || focused);
  const ease = [0.22, 1, 0.36, 1] as const;
  const d = (seconds: number) => (reducedMotion ? 0 : seconds);

  return (
    <AnimatePresence>
      {past && (
        <motion.div
          key="whatsapp"
          ref={rootRef}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: d(0.5), ease }}
          // Reversed column with the tile FIRST in the DOM: focus flows
          // tile → doors on Tab, while visually the panel still sits above.
          // Source-ordering the panel first would put it after the tile in the
          // page's tab sequence — i.e. nowhere, since the tile is the last
          // tabbable element in the document.
          className="
            fixed z-30 flex flex-col-reverse items-end
            right-5 md:right-8
            bottom-[calc(1.25rem+env(safe-area-inset-bottom))]
            md:bottom-[calc(2rem+env(safe-area-inset-bottom))]
          "
        >
          {/* ── The tile ─────────────────────────────────────────────── */}
          <button
            type="button"
            ref={tileRef}
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="whatsapp-doors"
            // The accessible name is always the whole invitation, whether or
            // not the label happens to be unfurled — the visual state is
            // decoration, and the button should never announce as just a mark.
            aria-label={t('aria')}
            // Hover means a mouse. Touch browsers synthesize a sticky
            // mouseenter on tap that nothing ever clears, which would leave
            // the label wedged open on phones — so the pointer type is
            // checked. Focus opens it only when the focus is visible (i.e.
            // keyboard): Android also focuses buttons on tap, same wedge.
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
            onFocus={(e) => setFocused(e.currentTarget.matches(':focus-visible'))}
            onBlur={() => setFocused(false)}
            className={`
              group flex items-center
              hover:bg-burgundy hover:text-cream
              transition-colors duration-500 ease-out
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy
              ${onDark ? 'bg-cream text-dark' : 'bg-dark text-cream'}
            `}
          >
            <AnimatePresence initial={false}>
              {labelOpen && (
                <motion.span
                  key="label"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{
                    width: { duration: d(0.55), ease },
                    opacity: { duration: d(0.35), ease: 'easeOut' },
                  }}
                  className="overflow-hidden"
                >
                  <span className="block whitespace-nowrap font-body text-[13px] leading-none pl-5 pr-1 py-1">
                    {/* Tones, not colours: both halves inherit whatever the
                        tile is currently set to, so the inversion carries the
                        label with it and there is nothing to keep in sync. */}
                    <span className="opacity-60">{t('questions')}</span>{' '}
                    <span>{t('chat')}</span>
                  </span>
                </motion.span>
              )}
            </AnimatePresence>

            {/* The mark gives way to a close glyph while the panel is up, so
                the same square reads as the way back out. */}
            <span aria-hidden className="relative grid place-items-center h-14 w-14 shrink-0">
              <AnimatePresence initial={false} mode="wait">
                {menuOpen ? (
                  <motion.span
                    key="close"
                    initial={{ opacity: 0, rotate: -45 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 45 }}
                    transition={{ duration: d(0.2), ease: 'easeOut' }}
                    className="grid place-items-center"
                  >
                    <X className="h-[20px] w-[20px]" strokeWidth={1.5} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="glyph"
                    initial={{ opacity: 0, rotate: 45 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -45 }}
                    transition={{ duration: d(0.2), ease: 'easeOut' }}
                    className="grid place-items-center"
                  >
                    <WhatsAppGlyph />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </button>

          {/* ── The three doors ─────────────────────────────────────── */}
          <AnimatePresence>
            {menuOpen && (
              <motion.nav
                key="doors"
                id="whatsapp-doors"
                aria-label={t('aria')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: d(0.35), ease }}
                className="
                  mb-3 w-[min(20rem,calc(100vw-2.5rem))]
                  max-h-[calc(100dvh-8rem)] overflow-y-auto
                  bg-warm-white border border-ink/10 shadow-xl shadow-ink/10
                "
              >
                {/* Opacities here are measured, not chosen by eye. Chalet ships a single
                    weight, so `font-medium` would only trigger the browser's synthetic
                    bold — a smeared, uneven thickening on a face this refined. Contrast
                    is the honest lever: ink at 50% over warm-white lands at 2.76:1, well
                    under the 4.5:1 floor for text this size, which is what read as thin
                    rather than as quiet. 70% clears it at 4.65:1 and still sits a clear
                    step below the full-ink titles at 11:1, so the hierarchy survives. */}
                <p className="font-body text-[11px] tracking-[0.22em] uppercase text-ink/70 px-5 pt-4 pb-3 border-b border-ink/10">
                  {t('help')}
                </p>

                <ul className="divide-y divide-ink/10">
                  {DOORS.map((door) => (
                    <li key={door}>
                      <a
                        href={whatsappUrl(t(`doors.${door}.message`))}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuOpen(false)}
                        className="block px-5 py-4 hover:bg-ink/[0.04] transition-colors duration-300"
                      >
                        <span className="block font-body text-sm text-ink leading-snug">
                          {t(`doors.${door}.title`)}
                        </span>
                        <span className="block font-body text-[13px] text-ink/75 leading-snug mt-1">
                          {t(`doors.${door}.detail`)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.nav>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
