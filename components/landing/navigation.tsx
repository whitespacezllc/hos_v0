'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, getPathname, usePathname } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { BOOK_PATH } from '@/lib/cloudbeds';
import { rememberLocale } from '@/lib/locale-cookie';

// ─── Routes ─────────────────────────────────────────────────────────────────
// Single source of truth for the primary nav links. Rendered only inside
// the drawer (the closed navbar shows just hamburger + logo + lang/CTA,
// matching the Aman pattern). Labels live in the catalogue under nav.items,
// keyed by `id`.
const navItems = [
  { id: 'yoga', href: '/yoga' },
  { id: 'stay', href: '/stay-with-us' },
  { id: 'retreats', href: '/retreats' },
  // Anchor into the home page rather than a route of its own — the section
  // lives at <section id="seasonal-experiences"> in seasonal-experiences.tsx.
  { id: 'seasonal', href: '/#seasonal-experiences' },
  { id: 'about', href: '/about' },
  { id: 'contact', href: '/contact' },
] as const;

// ─── Link targets ───────────────────────────────────────────────────────────
// `Link` (from i18n/navigation) adds `/es` to a Spanish reader's links on its
// own. An anchor into the home page is the one shape it needs help with: as a
// string, `/#seasonal-experiences` would be prefixed to `/es/#…`, a trailing
// slash the router then has to redirect away. Split into pathname and hash it
// comes out as `/es#seasonal-experiences`, which is what the section is at.
function toLinkHref(href: string): string | { pathname: string; hash: string } {
  if (!href.includes('#')) return href;
  const [path, hash] = href.split('#');
  return { pathname: path || '/', hash };
}

// ─── Active-route helper ────────────────────────────────────────────────────
// startsWith so /retreats/[slug] keeps the "Retreats" link marked active.
// `usePathname` here is next-intl's: it returns the path without the locale
// prefix, so `/es/retreats` compares equal to the English href.
function useActiveRoute() {
  const pathname = usePathname();
  return (href: string): boolean => {
    // Anchor links point at a section, not a route — never mark them active,
    // otherwise they'd light up across the whole page they live on.
    if (href.includes('#')) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

// ─── Scroll-driven navbar state ─────────────────────────────────────────────
// One listener drives both behaviours, so they can never disagree about where
// the page is:
//
//   compact — past `compactAt`, the bar and logo shrink.
//   hidden  — reading downward retracts the bar; the smallest move back up
//             brings it straight back. Above `revealAt` it is always shown, so
//             the top of the page never opens on a hidden navbar.
//
// `DELTA` swallows the sub-pixel jitter of trackpads and iOS rubber-banding,
// which would otherwise flap the bar open and shut while the reader is holding
// still.
const DELTA = 6;

function useNavbarScrollState({ compactAt = 80, revealAt = 140 } = {}) {
  const [state, setState] = useState({ isCompact: false, isHidden: false });

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const measure = () => {
      const y = window.scrollY;
      const isCompact = y > compactAt;

      let isHidden: boolean | null = null;
      if (y <= revealAt) {
        isHidden = false;
      } else if (Math.abs(y - lastY) > DELTA) {
        isHidden = y > lastY;
      }

      if (Math.abs(y - lastY) > DELTA) lastY = y;

      setState((prev) => {
        const next = { isCompact, isHidden: isHidden ?? prev.isHidden };
        return prev.isCompact === next.isCompact && prev.isHidden === next.isHidden
          ? prev
          : next;
      });
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [compactAt, revealAt]);

  return state;
}

// ─── Logo (image) ───────────────────────────────────────────────────────────
//   Compact:  35px / 45px
//   Expanded: 45px / 60px
// `sizeOverride` lets the drawer use a fixed mid-size for its own header.
function HOSLogo({
  isCompact,
  sizeOverride,
}: {
  isCompact: boolean;
  sizeOverride?: string;
}) {
  const sizeClass =
    sizeOverride ??
    (isCompact ? 'h-[35px] lg:h-[45px]' : 'h-[45px] lg:h-[60px]');
  return (
    <img
      src="/logos/logo-hos-negro.webp"
      alt="House of Shakti"
      draggable={false}
      className={`${sizeClass} w-auto select-none transition-all duration-[400ms] ease-out`}
      decoding="async"
    />
  );
}

// ─── Language toggle ────────────────────────────────────────────────────────
// Two small marks and a hairline — the same quiet register as the rest of the
// bar, and a replacement for the old dropdown, which was a menu of two items
// that changed nothing. The active language carries full ink; the inactive one
// is an outline of itself until approached. Present on every breakpoint: on
// phones it takes the navbar's right zone, which the layout was already
// reserving as an empty spacer to keep the logo centred.
//
// Each mark is a real link to the same page in the other language — `/yoga`
// ⇄ `/es/yoga`, `/stay-with-us` ⇄ `/es/stay-with-us` — so a crawler finds the
// other version from every page and a cmd-click opens it in a new tab. A plain
// click navigates in place: the query string and the hash come along, the
// reader stays where they were on the page, and the choice is remembered in a
// NEXT_LOCALE cookie (lib/locale-cookie.ts — client-side only). No route map:
// `getPathname` derives the target from the current path, whatever page this
// is.
function LangToggle() {
  const t = useTranslations('nav');
  const locale = useLocale();
  // Locale-less, so the same page can be named in the other language.
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (next: AppLocale) => {
    if (next === locale) return;
    rememberLocale(next);
    // Next's own router, not next-intl's: the latter would name the English
    // page `/en/yoga` when switching to it explicitly, and the proxy would
    // then redirect that to `/yoga` — one hop the reader never needs to make.
    // `getPathname` already knows that English carries no prefix.
    const target = getPathname({ href: pathname, locale: next });
    router.replace(`${target}${window.location.search}${window.location.hash}`, { scroll: false });
  };

  const option = (code: AppLocale) => (
    <NextLink
      href={getPathname({ href: pathname, locale: code })}
      hrefLang={code}
      aria-current={locale === code ? 'true' : undefined}
      onClick={(e) => {
        // Let the browser handle modified clicks (new tab, etc.) via the href.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        switchTo(code);
      }}
      className={`font-body text-[11px] tracking-[0.18em] uppercase transition-colors duration-300 ${
        locale === code ? 'text-ink' : 'text-ink/35 hover:text-ink/70'
      }`}
    >
      {code.toUpperCase()}
    </NextLink>
  );

  return (
    <div
      role="group"
      aria-label={t('changeLanguage')}
      className="flex items-center gap-2.5"
    >
      {routing.locales.map((code, i) => (
        <span key={code} className="contents">
          {i > 0 && <span aria-hidden className="h-3 w-px bg-ink/25" />}
          {option(code)}
        </span>
      ))}
    </div>
  );
}

// ─── Reserve CTA ────────────────────────────────────────────────────────────
// A link to /book, where the Cloudbeds engine renders inside the page (see
// lib/cloudbeds.ts) — the reader never leaves the site. A link like any other
// in the bar: `Link` adds `/es` for a Spanish reader, and a cmd-click opens it
// in a new tab. Same door as CheckAvailabilityLink on /stay-with-us.
function ReserveCta({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const t = useTranslations('nav');
  return (
    <Link href={BOOK_PATH} onClick={onNavigate} className={className}>
      {t('reserve')}
    </Link>
  );
}

// ─── Drawer ─────────────────────────────────────────────────────────────────
// Slides in from LEFT. On desktop: 420px wide panel + dimmed backdrop on the
// remaining area (Aman pattern — lang + Reserve in the navbar remain visible to
// the right). On mobile: full-screen, and the drawer also holds the CTA, since
// that is hidden from the mobile navbar.
function Drawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const isActive = useActiveRoute();
  const pathname = usePathname();
  const t = useTranslations('nav');

  // Anchor links (e.g. "/#seasonal-experiences") need special handling: while
  // the drawer is open the body carries `overflow: hidden`, so the browser's
  // native jump-to-hash is swallowed and the page never moves. When we're
  // already on the target route we take over — close the drawer, then scroll
  // on the next frame, once the lock has been released. Cross-route hash
  // navigation is left to the router, which remounts the page and handles it.
  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (!href.includes('#')) {
      onClose();
      return;
    }
    const [path, hash] = href.split('#');
    const targetPath = path || '/';
    if (pathname !== targetPath) {
      onClose();
      return; // different route — let Next handle navigation + hash
    }
    e.preventDefault();
    onClose();
    // Keep the URL in sync so the anchor is shareable / back-button friendly.
    window.history.replaceState(null, '', `#${hash}`);
    // Release the scroll lock here rather than waiting for the close effect to
    // clean up: that takes more than one frame (setState → re-render → effect
    // cleanup), and a scroll issued while `overflow: hidden` is still applied
    // is silently dropped. The effect's own cleanup resets to the same value,
    // so doing it early is harmless.
    document.body.style.overflow = '';

    const target = document.getElementById(hash);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth' });

    // Safety net: a few embedded/automation browsers drop smooth scrolls
    // outright instead of falling back to an instant jump, which would leave
    // the link doing nothing at all. If we genuinely haven't moved, jump.
    // Must be 'instant', not 'auto' — 'auto' defers to the CSS
    // `scroll-behavior: smooth` on <html>, i.e. the very thing that failed.
    const distance = target.getBoundingClientRect().top;
    if (distance > 4) {
      window.setTimeout(() => {
        if (window.scrollY < 4) {
          target.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
        }
      }, 300);
    }
  };

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Body scroll lock while drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — dims the rest of the page on desktop. Click closes.
              Uses bg-ink (warm charcoal) instead of bg-dark (burgundy) so the
              overlay reads as a neutral, editorial fog rather than a colored
              tint on the warm-white page. */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/30"
          />

          {/* Drawer panel */}
          <motion.div
            id="primary-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('siteNavigation')}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="fixed top-0 left-0 bottom-0 z-50 w-full lg:w-[420px] bg-warm-white"
          >
            <div className="h-full flex flex-col p-6 sm:p-8">
              {/* Drawer top — X (left), logo (center) */}
              <div className="flex items-center justify-between border-b border-ink/10 pb-6">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('closeMenu')}
                  className="text-ink hover:opacity-70 transition-opacity duration-300"
                >
                  <X className="w-[22px] h-[22px]" strokeWidth={1.5} />
                </button>

                <Link
                  href="/"
                  onClick={onClose}
                  className="inline-flex items-center hover:opacity-80 transition-opacity duration-300"
                >
                  <HOSLogo isCompact={false} sizeOverride="h-9" />
                </Link>

                {/* Spacer to balance the X on the left so the logo sits centered */}
                <span aria-hidden className="w-[22px] h-[22px]" />
              </div>

              {/* Nav links */}
              <nav
                aria-label={t('siteSections')}
                className="mt-12 space-y-6"
              >
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={toLinkHref(item.href)}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className={`block font-display font-light text-ink text-2xl hover:opacity-70 transition-opacity duration-300 ${
                      isActive(item.href)
                        ? 'underline underline-offset-4 decoration-[0.5px]'
                        : ''
                    }`}
                  >
                    {t(`items.${item.id}`)}
                  </Link>
                ))}
              </nav>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Mobile-only: the CTA lives in the navbar on desktop, where it
                  stays visible above the backdrop, so it doesn't repeat there.
                  The language toggle is no longer duplicated here either — it
                  now sits in the navbar on phones too. */}
              <ReserveCta
                onNavigate={onClose}
                className="lg:hidden block w-full text-center bg-dark text-cream font-body text-sm py-4 hover:bg-burgundy transition-colors duration-300 mt-8"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export function Navigation() {
  const t = useTranslations('nav');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isCompact, isHidden } = useNavbarScrollState();

  // The drawer's own controls live in this bar on desktop, so it must never be
  // retracted while the drawer is open.
  const retracted = isHidden && !drawerOpen;

  const heightClass = isCompact ? 'h-14 lg:h-20' : 'h-20 lg:h-28';

  return (
    <>
      <motion.header
        animate={{ y: retracted ? '-100%' : '0%' }}
        // Long enough to read as the bar withdrawing rather than blinking out.
        // The curve leaves quickly and arrives slowly, so the return never
        // overshoots into the reader's line of sight.
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className={`
          fixed top-0 left-0 right-0 z-50
          bg-warm-white
          transition-[height] duration-[400ms] ease-out
          ${heightClass}
        `}
      >
        {/* A <nav> landmark, not a <div>: this bar is the site's primary
            navigation and there was no navigation landmark anywhere in the
            document — the drawer's own <nav> only mounts once it is opened.
            Same element box, same classes, nothing moves. */}
        <nav
          aria-label={t('mainNavigation')}
          className="h-full w-full px-4 sm:px-6 lg:px-12 grid grid-cols-3 items-center"
        >
          {/* LEFT — hamburger (+ "Menu" text on desktop) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('openMenu')}
            aria-controls="primary-drawer"
            aria-expanded={drawerOpen}
            className="justify-self-start flex items-center gap-4 lg:gap-5 text-ink hover:opacity-70 transition-opacity duration-300"
          >
            <Menu className="w-[22px] h-[22px]" strokeWidth={1.5} />
            <span className="hidden lg:inline font-body text-sm tracking-[0.05em]">
              {t('menu')}
            </span>
          </button>

          {/* CENTER — Logo */}
          <Link
            href="/"
            className="justify-self-center inline-flex items-center hover:opacity-80 transition-opacity duration-300 leading-none"
          >
            <HOSLogo isCompact={isCompact} />
          </Link>

          {/* RIGHT — language toggle everywhere; the Reserve CTA joins it on
              desktop. On phones the toggle takes the slot the grid was already
              reserving to keep the logo centred. */}
          <div className="hidden lg:flex items-center gap-6 justify-self-end">
            <LangToggle />
            <ReserveCta className="bg-dark text-cream font-body text-sm tracking-[0.05em] px-6 py-2.5 hover:bg-burgundy transition-colors duration-300" />
          </div>

          <div className="lg:hidden justify-self-end">
            <LangToggle />
          </div>
        </nav>
      </motion.header>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
