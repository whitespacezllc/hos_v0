'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Users,
  Tag,
  Ticket,
  Package,
  Palmtree,
  LogOut,
  Loader2,
  Menu,
  X,
  LucideIcon,
} from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { setAdminLocale } from '@/app/actions/admin-locale';
import { routing, type AppLocale } from '@/i18n/routing';

// ─── Navigation items ───────────────────────────────────────────────────────
// The labels live in the catalogue (admin.nav); the hrefs never change
// language — there is one /admin, and the panel's language is a preference
// (lib/admin-locale.ts).
type NavItem = { href: string; key: 'dashboard' | 'calendar' | 'schedule' | 'bookings' | 'packs' | 'upsells' | 'promo' | 'retreats'; icon: LucideIcon; exact?: boolean };

const navItems: NavItem[] = [
  { href: '/admin',            key: 'dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/calendario', key: 'calendar',  icon: Calendar },
  { href: '/admin/clases',     key: 'schedule',  icon: BookOpen },
  { href: '/admin/reservas',   key: 'bookings',  icon: Users },
  { href: '/admin/paquetes',   key: 'packs',     icon: Package },
  { href: '/admin/upsells',    key: 'upsells',   icon: Tag },
  { href: '/admin/refers',     key: 'promo',     icon: Ticket },
  { href: '/admin/retreats',   key: 'retreats',  icon: Palmtree },
];

type PendingCounts = Partial<Record<string, number>>;

// ─── Inner content — used by both the desktop fixed sidebar and the mobile
// drawer. `onNavigate` lets the parent close the drawer when a link is tapped.
function SidebarBody({
  onNavigate,
  pendingCounts,
  adminEmail,
}: {
  onNavigate?: () => void;
  pendingCounts?: PendingCounts;
  /** The signed-in admin, shown in the user block; the avatar takes its first letter. */
  adminEmail?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('admin.sidebar');
  const tNav = useTranslations('admin.nav');
  const locale = useLocale() as AppLocale;
  const [signingOut, startSignOut] = useTransition();
  const [switching, startSwitch] = useTransition();
  const initial = (adminEmail?.trim()[0] ?? 'A').toUpperCase();

  // The toggle writes the preference cookie and re-renders the tree in the
  // new language; the URL stays where it is.
  function switchTo(next: AppLocale) {
    if (next === locale) return;
    startSwitch(async () => {
      await setAdminLocale(next);
      router.refresh();
    });
  }

  const isActive = (item: NavItem): boolean => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    // `w-full min-w-0`: as a flex item of the aside this body would otherwise
    // size to its content, and the email below doesn't wrap: a long address
    // pushed the burgundy past 260px and over the page, and a short one left a
    // gap. It takes the aside's width, and the email truncates inside it.
    <div className="flex flex-col h-full w-full min-w-0 bg-burgundy text-cream">
      {/* TOP — brand block. Not a link: admin is its own context. */}
      <div className="flex-none px-6 pt-8 pb-6">
        <p className="font-display text-xl font-light text-cream leading-tight pr-8 lg:pr-0">
          {t('brand')}
        </p>
      </div>

      {/* MIDDLE — navigation */}
      <nav className="flex-1 min-h-0 px-3 overflow-y-auto" aria-label={t('navigation')}>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            const count = pendingCounts?.[item.href] ?? 0;
            const hasPending = count > 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={`
                    flex items-center gap-3 px-4 py-2.5
                    font-body text-sm
                    transition-all duration-200 ease-out
                    border-l-2
                    ${
                      active
                        ? 'bg-black/20 text-cream border-cream'
                        : hasPending
                          ? 'text-cream border-transparent bg-black/10 hover:bg-black/15'
                          : 'text-cream/85 border-transparent hover:bg-black/10 hover:text-cream'
                    }
                  `}
                >
                  <Icon
                    className={`flex-shrink-0 ${active || hasPending ? 'text-cream' : 'text-cream/85'}`}
                    width={18}
                    height={18}
                    strokeWidth={1.5}
                  />
                  <span className="min-w-0 truncate">{tNav(item.key)}</span>
                  {hasPending && (
                    <span
                      aria-label={t('pending', { count })}
                      className="ml-auto flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-cream text-burgundy font-body text-xs font-semibold rounded-full leading-none"
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* BOTTOM — user block + language toggle */}
      <div className="flex-none border-t border-cream/15 px-6 py-4 space-y-3">
        {/* User block — who is signed in, and the way out. Sign-out is a
            server action: the cookies are cleared where they were set, and
            the redirect to /login already arrives without a session. */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            aria-hidden
            className="w-9 h-9 bg-black/25 flex items-center justify-center font-body text-sm font-medium text-cream rounded-full flex-shrink-0"
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm text-cream leading-tight truncate" title={adminEmail}>
              {adminEmail ?? t('admin')}
            </p>
            <p className="font-body text-xs text-cream/70 mt-0.5 truncate">{t('roleLine')}</p>
          </div>
          <button
            type="button"
            onClick={() => startSignOut(() => signOut())}
            disabled={signingOut}
            aria-label={t('signOut')}
            title={t('signOut')}
            className="w-9 h-9 -mr-2 inline-flex items-center justify-center text-cream/80 hover:text-cream transition-colors duration-200 cursor-pointer flex-shrink-0 disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 width={16} height={16} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <LogOut width={16} height={16} strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Language toggle — the panel's language, remembered in a cookie. */}
        <div className="flex items-center gap-3 h-7" role="group" aria-label={t('language')}>
          {routing.locales.map((code) => {
            const current = code === locale;
            return (
              <button
                key={code}
                type="button"
                onClick={() => switchTo(code)}
                disabled={switching}
                aria-pressed={current}
                aria-label={t(`languageName.${code}`)}
                className={
                  current
                    ? 'font-body text-xs text-cream underline underline-offset-4 decoration-[0.5px] cursor-default'
                    : 'font-body text-xs text-cream/70 hover:text-cream transition-colors duration-200 cursor-pointer disabled:opacity-60'
                }
              >
                {code.toUpperCase()}
              </button>
            );
          })}
          {switching && <Loader2 width={12} height={12} strokeWidth={1.5} className="animate-spin text-cream/80" />}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar component ──────────────────────────────────────────────────────
// Renders both modes from a single component:
//  - lg+: fixed sidebar
//  - <lg: sticky top bar (menu button + brand) + slide-in drawer
export function Sidebar({ pendingCounts, adminEmail }: { pendingCounts?: PendingCounts; adminEmail?: string }) {
  const t = useTranslations('admin.sidebar');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const totalPending = Object.values(pendingCounts ?? {}).reduce<number>((acc, n) => acc + (n ?? 0), 0);

  // While open: Escape closes it, and so does growing past the drawer's
  // breakpoint (rotating a tablet), which would otherwise leave the page locked.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const wide = window.matchMedia('(min-width: 64rem)');
    const onWide = () => {
      if (wide.matches) setDrawerOpen(false);
    };
    wide.addEventListener('change', onWide);
    return () => {
      window.removeEventListener('keydown', onKey);
      wide.removeEventListener('change', onWide);
    };
  }, [drawerOpen]);

  useScrollLock(drawerOpen);

  return (
    <>
      {/* Fixed sidebar (lg+). `overflow-hidden` so nothing inside can ever
          paint over the page. */}
      <aside
        className="hidden lg:flex fixed left-0 top-0 h-dvh w-[260px] z-30 overflow-hidden"
        aria-label={t('sidebar')}
      >
        <SidebarBody pendingCounts={pendingCounts} adminEmail={adminEmail} />
      </aside>

      {/* Top bar (<lg). In the flow, so it pushes the page down and never sits
          on top of a title. */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-2 h-14 pl-2 pr-4 bg-burgundy text-cream">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t('openMenu')}
          aria-controls="admin-mobile-drawer"
          aria-expanded={drawerOpen}
          className="w-10 h-10 flex items-center justify-center text-cream hover:bg-black/15 transition-colors duration-200 cursor-pointer"
        >
          <Menu width={20} height={20} strokeWidth={1.5} />
        </button>
        <p className="font-display text-lg font-light leading-none truncate">{t('brand')}</p>
        {totalPending > 0 && (
          <span
            aria-label={t('pending', { count: totalPending })}
            className="ml-auto flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-cream text-burgundy font-body text-xs font-semibold rounded-full leading-none"
          >
            {totalPending > 99 ? '99+' : totalPending}
          </span>
        )}
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={() => setDrawerOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-ink/40"
            />

            {/* Drawer panel */}
            <motion.aside
              id="admin-mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={t('navigation')}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[280px] max-w-[85vw]"
            >
              <div className="relative h-full">
                <SidebarBody onNavigate={() => setDrawerOpen(false)} pendingCounts={pendingCounts} adminEmail={adminEmail} />

                {/* Close button inside drawer (top-right) */}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label={t('closeMenu')}
                  className="absolute top-4 right-2 w-10 h-10 flex items-center justify-center text-cream/80 hover:text-cream transition-colors duration-200 cursor-pointer"
                >
                  <X width={20} height={20} strokeWidth={1.5} />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
