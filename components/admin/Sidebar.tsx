'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

// ─── Navigation items ───────────────────────────────────────────────────────
// English labels only — the chrome ships English-first per Phase 9.1.
// The page contents (translated in 9.2–9.4) still use the i18n context.
type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const navItems: NavItem[] = [
  { href: '/admin',            label: 'Dashboard',   icon: LayoutDashboard, exact: true },
  { href: '/admin/calendario', label: 'Calendar',    icon: Calendar },
  { href: '/admin/clases',     label: 'Schedule',    icon: BookOpen },
  { href: '/admin/reservas',   label: 'Bookings',    icon: Users },
  { href: '/admin/paquetes',   label: 'Packs',       icon: Package },
  { href: '/admin/upsells',    label: 'Upsells',     icon: Tag },
  { href: '/admin/refers',     label: 'Promo codes', icon: Ticket },
  { href: '/admin/retreats',   label: 'Retreats',    icon: Palmtree },
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
  const [signingOut, startSignOut] = useTransition();
  const initial = (adminEmail?.trim()[0] ?? 'A').toUpperCase();

  const isActive = (item: NavItem): boolean => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <div className="flex flex-col h-full bg-burgundy text-cream">
      {/* TOP — brand block. Not a link: admin is its own context. */}
      <div className="px-6 pt-10 pb-12">
        <p className="font-body text-[10px] tracking-[0.3em] uppercase text-cream/40">
          Admin panel
        </p>
        <h1 className="font-display text-xl font-light text-cream leading-tight mt-2">
          House of Shakti
        </h1>
      </div>

      {/* MIDDLE — navigation */}
      <nav className="flex-1 px-3 overflow-y-auto" aria-label="Admin navigation">
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
                    flex items-center gap-3 px-4 py-3
                    font-body text-sm
                    transition-all duration-200 ease-out
                    border-l-2
                    ${
                      active
                        ? 'bg-black/20 text-cream border-cream'
                        : hasPending
                          ? 'text-cream border-transparent bg-black/10 hover:bg-black/15'
                          : 'text-cream/70 border-transparent hover:bg-black/10 hover:text-cream'
                    }
                  `}
                >
                  <Icon
                    className={active || hasPending ? 'text-cream' : 'text-cream/70'}
                    width={18}
                    height={18}
                    strokeWidth={1.5}
                  />
                  <span>{item.label}</span>
                  {hasPending && (
                    <span
                      aria-label={`${count} pending`}
                      className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-cream text-burgundy font-body text-xs font-semibold rounded-full leading-none"
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
      <div className="border-t border-cream/15 px-6 py-6 space-y-4">
        {/* User block — who is signed in, and the way out. Sign-out is a
            server action: the cookies are cleared where they were set, and
            the redirect to /login already arrives without a session. */}
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="w-10 h-10 bg-black/25 flex items-center justify-center font-body text-sm font-medium text-cream rounded-full flex-shrink-0"
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm text-cream leading-tight truncate" title={adminEmail}>
              {adminEmail ?? 'Admin'}
            </p>
            <p className="font-body text-[10px] text-cream/50 mt-0.5 truncate">Admin · House of Shakti</p>
          </div>
          <button
            type="button"
            onClick={() => startSignOut(() => signOut())}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
            className="text-cream/50 hover:text-cream transition-colors duration-200 cursor-pointer flex-shrink-0 disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 width={16} height={16} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <LogOut width={16} height={16} strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Language toggle.
            TODO: implement i18n language switching when ES translations are
            ready. Currently UI-only — both buttons no-op. */}
        <div className="flex items-center gap-2">
          <div
            aria-hidden
            className="w-8 h-8 bg-cream/10 text-cream font-body text-xs flex items-center justify-center rounded-full flex-shrink-0"
          >
            N
          </div>
          <button
            type="button"
            className="font-body text-xs text-cream/40 hover:text-cream/70 transition-colors duration-200 cursor-pointer"
          >
            ES
          </button>
          <button
            type="button"
            className="font-body text-xs text-cream tracking-[0.1em] underline underline-offset-4 decoration-[0.5px] cursor-pointer"
          >
            EN
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar component ──────────────────────────────────────────────────────
// Renders all three modes from a single component:
//  - md+: fixed desktop sidebar
//  - <md: fixed hamburger button (top-left of viewport) + slide-in drawer
export function Sidebar({ pendingCounts, adminEmail }: { pendingCounts?: PendingCounts; adminEmail?: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Body scroll lock while drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <>
      {/* Desktop fixed sidebar (md+) */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-screen w-[260px] z-30"
        aria-label="Admin sidebar"
      >
        <SidebarBody pendingCounts={pendingCounts} adminEmail={adminEmail} />
      </aside>

      {/* Mobile hamburger button (<md) — fixed top-left of viewport */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open admin menu"
        aria-controls="admin-mobile-drawer"
        aria-expanded={drawerOpen}
        className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 flex items-center justify-center bg-white border border-ink/15 text-ink hover:bg-neutral-100 transition-colors duration-200 cursor-pointer"
      >
        <Menu width={20} height={20} strokeWidth={1.5} />
      </button>

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
              className="md:hidden fixed inset-0 z-40 bg-ink/40"
            />

            {/* Drawer panel */}
            <motion.aside
              id="admin-mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-[260px]"
            >
              <div className="relative h-full">
                <SidebarBody onNavigate={() => setDrawerOpen(false)} pendingCounts={pendingCounts} adminEmail={adminEmail} />

                {/* Close button inside drawer (top-right) */}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close admin menu"
                  className="absolute top-4 right-4 text-cream/70 hover:text-cream transition-colors duration-200 cursor-pointer"
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
