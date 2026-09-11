'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Eye,
  Trash2,
  User as UserIcon,
  Phone,
  Tag,
  CalendarDays,
  MapPin,
  DollarSign,
  Users as UsersIcon,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Booking } from '@/types';
import type { AppLocale } from '@/i18n/routing';
import { dateFnsLocale } from '@/lib/dates';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Badge } from '@/components/admin/Badge';
import { EmptyState } from '@/components/admin/EmptyState';
import { DeleteConfirmation } from '@/components/admin/DeleteConfirmation';
import { NativeSelect } from '@/components/admin/NativeSelect';
import { RowIconButton } from '@/app/admin/clases/_components/ClasesClient';
import { confirmBooking, cancelBookingAdmin } from '@/app/actions/bookings';
import type { PaymentMethod } from '@/lib/payment-methods';
import { costaRicaDateString, inCostaRica } from '@/lib/costa-rica-time';

type SerializedBooking = Omit<Booking, 'createdAt'> & { createdAt: string };

type ClassInfo = {
  id: string;
  name: string;
  startsAt: string;
  color?: string | null;
  priceUsd: number;
};
type UpsellInfo = { id: string; name: string; priceUsd: number };

// The amount this booking is worth: what the customer paid or owes for it
// (the database's total, which already knows about codes and extras) plus
// the pack when the class was bought together with one.
function bookingTotal(b: SerializedBooking): number {
  return (b.totalUsd ?? 0) + (b.packPurchase?.amountUsd ?? 0);
}

type BadgeVariant = 'active' | 'warning' | 'inactive' | 'destructive' | 'neutral';

// Map paymentStatus → Badge variant + display label (matches Calendar mapping).
// The labels come from admin.common.status, in the admin's language.
function usePaymentBadge() {
  const tc = useTranslations('admin.common');
  return (status: Booking['paymentStatus']): { variant: BadgeVariant; label: string } => {
    switch (status) {
      case 'paid':
        return { variant: 'active', label: tc('status.paid') };
      case 'free':
        return { variant: 'neutral', label: tc('status.free') };
      case 'pending':
        return { variant: 'warning', label: tc('status.pending') };
      case 'cancelled':
        return { variant: 'inactive', label: tc('status.cancelled') };
      case 'no-show':
        return { variant: 'destructive', label: tc('status.noShow') };
      default:
        return { variant: 'neutral', label: status };
    }
  };
}

// The catalogue key for a booking's payment method. A booking without one is
// read as paid by card, as the old shared label helper did.
function paymentMethodKey(method: PaymentMethod | null | undefined): PaymentMethod {
  return method ?? 'card';
}

// How many bookings show per page. Keeps the list scannable instead of an
// endless scroll; pending ones are highlighted so they don't get lost.
const PAGE_SIZE = 6;

// ═══════════════════════════════════════════════════════════════════════════
export default function ReservasClient({
  initialBookings,
  classMap,
  upsellMap,
}: {
  initialBookings: SerializedBooking[];
  classMap: Record<string, ClassInfo>;
  upsellMap: Record<string, UpsellInfo>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin.bookings');
  const tc = useTranslations('admin.common');

  // Filters — `?q=` pre-fills the search (e.g. deep-linked from Packs to
  // reconcile a customer's bookings against their pack).
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [fromDate, setFromDate] = useState(''); // YYYY-MM-DD, filters on booking date
  const [toDate, setToDate] = useState('');

  // Pagination — 6 per page.
  const [page, setPage] = useState(1);

  // Drawer + delete
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<SerializedBooking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Status filter options — the values are the database's, the labels the
  // admin's language.
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filters.allStatuses') },
      { value: 'paid', label: tc('status.paid') },
      { value: 'free', label: tc('status.free') },
      { value: 'pending', label: tc('status.pending') },
      { value: 'cancelled', label: tc('status.cancelled') },
      { value: 'no-show', label: tc('status.noShow') },
    ],
    [t, tc],
  );

  // Class filter options
  const classOptions = useMemo(() => {
    const present = Array.from(new Set(initialBookings.map((b) => b.className))).sort();
    return [
      { value: 'all', label: t('filters.allClasses') },
      ...present.map((name) => ({ value: name, label: name })),
    ];
  }, [initialBookings, t]);

  // Filter + sort
  const filtered = useMemo(() => {
    return initialBookings
      .filter((b) => {
        if (statusFilter !== 'all' && b.paymentStatus !== statusFilter) return false;
        if (classFilter !== 'all' && b.className !== classFilter) return false;
        if (fromDate && costaRicaDateString(b.createdAt) < fromDate) return false;
        if (toDate && costaRicaDateString(b.createdAt) > toDate) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !b.firstName.toLowerCase().includes(q) &&
            !b.lastName.toLowerCase().includes(q) &&
            !b.email.toLowerCase().includes(q) &&
            !b.bookingReference.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [initialBookings, search, statusFilter, classFilter, fromDate, toDate]);

  // Reset to the first page whenever the result set changes (filters/search).
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, classFilter, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Guard against a stale page index (e.g. after a booking is cancelled).
  const safePage = Math.min(page, pageCount);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const filtersActive =
    search !== '' ||
    statusFilter !== 'all' ||
    classFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== '';

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setClassFilter('all');
    setFromDate('');
    setToDate('');
  }

  const selectedBooking = useMemo(
    () => initialBookings.find((b) => b.id === selectedId) ?? null,
    [initialBookings, selectedId],
  );

  function openDetail(b: SerializedBooking) {
    setSelectedId(b.id);
    setDrawerOpen(true);
  }

  function handleConfirmPayment(id: string) {
    startTransition(async () => {
      await confirmBooking(id);
      router.refresh();
    });
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await cancelBookingAdmin(cancelTarget.id);
      setCancelTarget(null);
      setDrawerOpen(false);
      router.refresh();
    } finally {
      setIsCancelling(false);
    }
  }

  // Drawer math
  const selectedClass = selectedBooking ? classMap[selectedBooking.classId] : null;
  const selectedUpsells = selectedBooking
    ? (selectedBooking.upsells ?? []).map((id) => upsellMap[id]).filter(Boolean)
    : [];
  // What the customer pays: the booking's own total (the class, or nothing
  // when a code covers it, plus extras) and, for a class bought together with
  // a pack, the pack itself.
  const selectedTotal = selectedBooking ? bookingTotal(selectedBooking) : 0;

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-7xl mx-auto">
      <PageHeader
        heading={t('heading')}
        description={tc('units.bookings', { count: initialBookings.length })}
      />

      {initialBookings.length === 0 ? (
        <EmptyState
          icon={<UsersIcon strokeWidth={1} />}
          heading={t('empty.heading')}
          description={t('empty.description')}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="mb-6 flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
            <div className="relative md:w-72">
              <Search
                aria-hidden
                className="absolute left-0 top-1/2 -translate-y-1/2 text-ink/40"
                width={16}
                height={16}
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('filters.searchPlaceholder')}
                className="w-full pl-7 pb-2 border-b border-ink/20 bg-transparent font-body text-sm text-ink outline-none focus:border-ink transition-colors duration-200 placeholder:text-ink/30 placeholder:italic"
              />
            </div>
            <NativeSelect
              filter
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              options={classOptions}
              aria-label={t('filters.byClass')}
            />
            <NativeSelect
              filter
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
              aria-label={t('filters.byStatus')}
            />
            <div className="flex items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="font-body text-[10px] tracking-[0.15em] uppercase text-ink/50">{t('filters.from')}</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => setFromDate(e.target.value)}
                  aria-label={t('filters.fromDate')}
                  className="pb-2 border-b border-ink/20 bg-transparent font-body text-sm text-ink outline-none focus:border-ink transition-colors duration-200"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-body text-[10px] tracking-[0.15em] uppercase text-ink/50">{t('filters.to')}</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => setToDate(e.target.value)}
                  aria-label={t('filters.toDate')}
                  className="pb-2 border-b border-ink/20 bg-transparent font-body text-sm text-ink outline-none focus:border-ink transition-colors duration-200"
                />
              </label>
            </div>
            {filtersActive && (
              <Button variant="tertiary" onClick={clearFilters} className="md:ml-auto">
                {t('filters.clear')}
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search strokeWidth={1} />}
              heading={t('noMatch.heading')}
              description={t('noMatch.description')}
              action={
                filtersActive ? (
                  <Button variant="tertiary" onClick={clearFilters}>
                    {tc('actions.clearFilters')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <BookingsTable
                bookings={paginated}
                classMap={classMap}
                upsellMap={upsellMap}
                onView={openDetail}
                onCancel={(b) => setCancelTarget(b)}
              />
              <Pagination
                page={safePage}
                pageCount={pageCount}
                total={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      {/* ─── Drawer ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && selectedBooking && (
          <>
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-ink/30"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={t('drawer.title')}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[420px] lg:w-[480px] bg-white border-l border-ink/10 overflow-y-auto"
            >
              <BookingDrawerContent
                booking={selectedBooking}
                bookingClass={selectedClass}
                upsells={selectedUpsells}
                total={selectedTotal}
                isPending={isPending}
                onClose={() => setDrawerOpen(false)}
                onConfirmPayment={() => handleConfirmPayment(selectedBooking.id)}
                onCancel={() => setCancelTarget(selectedBooking)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <DeleteConfirmation
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title={t('cancelDialog.title')}
        description={t('cancelDialog.description')}
        confirmLabel={t('actions.cancelBooking')}
        cancelLabel={t('cancelDialog.keep')}
        loading={isCancelling}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Table
// ═══════════════════════════════════════════════════════════════════════════
function BookingsTable({
  bookings,
  classMap,
  upsellMap,
  onView,
  onCancel,
}: {
  bookings: SerializedBooking[];
  classMap: Record<string, ClassInfo>;
  upsellMap: Record<string, UpsellInfo>;
  onView: (b: SerializedBooking) => void;
  onCancel: (b: SerializedBooking) => void;
}) {
  const t = useTranslations('admin.bookings');
  const tc = useTranslations('admin.common');
  const dfLocale = dateFnsLocale(useLocale() as AppLocale);
  const paymentBadge = usePaymentBadge();

  const headers = [
    { label: tc('labels.code'), className: '' },
    { label: tc('labels.student'), className: '' },
    { label: tc('labels.class'), className: '' },
    { label: tc('labels.date'), className: 'hidden md:table-cell' },
    { label: tc('labels.people'), className: 'hidden lg:table-cell' },
    { label: tc('labels.total'), className: 'hidden lg:table-cell' },
    { label: tc('labels.status'), className: '' },
    { label: '', className: '' },
  ];

  return (
    <div className="bg-white border border-ink/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-50 border-b border-ink/10">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`text-left px-4 py-3 font-body text-[10px] tracking-[0.2em] uppercase font-medium text-ink/50 ${h.className}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const clase = classMap[b.classId];
              const upsells = (b.upsells ?? []).map((id) => upsellMap[id]).filter(Boolean);
              const total = bookingTotal(b);
              const badge = paymentBadge(b.paymentStatus);
              // Pending bookings are the ones surfaced in the sidebar badge —
              // give them a distinct tone (amber accent + tint) so the admin can
              // spot what still needs action at a glance.
              const isPending = b.paymentStatus === 'pending';

              return (
                <tr
                  key={b.id}
                  onClick={() => onView(b)}
                  className={`border-b border-ink/[0.08] last:border-0 transition-colors duration-200 cursor-pointer ${
                    isPending
                      ? 'bg-amber-50/70 hover:bg-amber-100/70 border-l-2 border-l-amber-500'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  <td className="px-4 py-4">
                    <span
                      className={`font-mono text-xs px-2 py-0.5 ${
                        isPending ? 'text-amber-900 bg-amber-100/60' : 'text-ink/70 bg-neutral-50'
                      }`}
                    >
                      {b.bookingReference}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-body text-sm font-medium text-ink truncate">
                      {b.firstName} {b.lastName}
                    </p>
                    <p className="font-body text-xs text-ink/50 mt-0.5 truncate">
                      {b.email}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-body text-sm text-ink truncate">{b.className}</p>
                    {clase && (
                      <p className="font-body text-xs text-ink/50 mt-0.5">
                        {format(inCostaRica(clase.startsAt), t('dates.classShort'), { locale: dfLocale })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="font-body text-sm text-ink/80">
                      {format(inCostaRica(b.createdAt), t('dates.dateShort'), { locale: dfLocale })}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="font-body text-sm text-ink">{b.persons}</span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="font-body text-sm font-medium text-ink">{tc('units.priceUsd', { amount: total })}</span>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <p className="font-body text-[10px] tracking-[0.15em] uppercase text-ink/40 mt-1.5">
                      {tc(`paymentMethod.${paymentMethodKey(b.paymentMethod)}`)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowIconButton
                        ariaLabel={t('table.viewBooking')}
                        onClick={() => onView(b)}
                      >
                        <Eye width={16} height={16} strokeWidth={1.5} />
                      </RowIconButton>
                      <RowIconButton
                        ariaLabel={t('actions.cancelBooking')}
                        onClick={() => onCancel(b)}
                        hoverDestructive
                        disabled={b.paymentStatus === 'cancelled'}
                      >
                        <Trash2 width={16} height={16} strokeWidth={1.5} />
                      </RowIconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Pagination
// ═══════════════════════════════════════════════════════════════════════════
function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const t = useTranslations('admin.bookings');

  if (pageCount <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  // Compact numbered pages with a leading/trailing ellipsis when there are many.
  const pages: (number | 'gap')[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'gap') {
      pages.push('gap');
    }
  }

  return (
    <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <p className="font-body text-xs text-ink/50">
        {t.rich('pagination.showing', {
          first,
          last,
          total,
          n: (chunks: React.ReactNode) => <span className="text-ink/70">{chunks}</span>,
        })}
      </p>
      <nav className="flex items-center gap-1" aria-label={t('pagination.label')}>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label={t('pagination.previous')}
          className="p-2 text-ink hover:bg-neutral-100 transition-colors duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft width={16} height={16} strokeWidth={1.5} />
        </button>
        {pages.map((p, i) =>
          p === 'gap' ? (
            <span
              key={`gap-${i}`}
              className="px-2 font-body text-sm text-ink/30 select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`min-w-[32px] h-8 px-2 font-body text-sm transition-colors duration-200 cursor-pointer ${
                p === page
                  ? 'bg-burgundy text-cream'
                  : 'text-ink hover:bg-neutral-100'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          aria-label={t('pagination.next')}
          className="p-2 text-ink hover:bg-neutral-100 transition-colors duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight width={16} height={16} strokeWidth={1.5} />
        </button>
      </nav>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Drawer
// ═══════════════════════════════════════════════════════════════════════════
function BookingDrawerContent({
  booking,
  bookingClass,
  upsells,
  total,
  isPending,
  onClose,
  onConfirmPayment,
  onCancel,
}: {
  booking: SerializedBooking;
  bookingClass: ClassInfo | null;
  upsells: UpsellInfo[];
  total: number;
  isPending: boolean;
  onClose: () => void;
  onConfirmPayment: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('admin.bookings');
  const tc = useTranslations('admin.common');
  const dfLocale = dateFnsLocale(useLocale() as AppLocale);
  const paymentBadge = usePaymentBadge();
  const badge = paymentBadge(booking.paymentStatus);

  // The pack purchase's status is a database value ('pending' | 'paid' |
  // 'cancelled'); anything else is shown as stored.
  function packStatusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return t('packStatus.pending');
      case 'paid':
        return t('packStatus.paid');
      case 'cancelled':
        return t('packStatus.cancelled');
      default:
        return status;
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-ink/10">
        <span className="font-mono text-xs text-ink/70 bg-neutral-50 px-2 py-0.5">
          {booking.bookingReference}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('drawer.close')}
          className="p-2 text-ink hover:opacity-70 transition-opacity duration-200 cursor-pointer"
        >
          <X width={20} height={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        <h2 className="font-body text-xl font-medium text-ink leading-tight">
          {booking.firstName} {booking.lastName}
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span className="font-body text-[10px] tracking-[0.15em] uppercase text-ink/50">
            {tc(`paymentMethod.${paymentMethodKey(booking.paymentMethod)}`)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          {booking.paymentStatus === 'pending' && (
            <Button
              variant="primary"
              icon={<Check width={16} height={16} strokeWidth={1.5} />}
              onClick={onConfirmPayment}
              loading={isPending}
            >
              {booking.paymentMethod === 'card' ? t('drawer.confirmPayment') : t('drawer.markAsPaid')}
            </Button>
          )}
          {booking.paymentStatus !== 'cancelled' && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 px-3 py-2 font-body text-sm text-burgundy hover:opacity-70 transition-opacity duration-200 cursor-pointer"
            >
              <Trash2 width={16} height={16} strokeWidth={1.5} />
              <span>{t('actions.cancelBooking')}</span>
            </button>
          )}
        </div>

        {/* Student section */}
        <Section title={tc('labels.student')}>
          <DrawerRow icon={<UserIcon width={14} height={14} strokeWidth={1.5} />} label={tc('labels.email')} value={booking.email} />
          {booking.phone && (
            <DrawerRow icon={<Phone width={14} height={14} strokeWidth={1.5} />} label={tc('labels.phone')} value={booking.phone} />
          )}
          {booking.referralCode && (
            <DrawerRow icon={<Tag width={14} height={14} strokeWidth={1.5} />} label={booking.referralCode.startsWith('PACK-') ? t('drawer.packCode') : t('drawer.promoCode')} value={booking.referralCode} />
          )}
          {booking.packPurchase && (
            <DrawerRow
              icon={<Tag width={14} height={14} strokeWidth={1.5} />}
              label={t('drawer.boughtWithPack')}
              value={`${tc('units.priceUsd', { amount: booking.packPurchase.amountUsd })} · ${packStatusLabel(booking.packPurchase.status)}${booking.packPurchase.code ? ` · ${booking.packPurchase.code}` : ''}`}
            />
          )}
          {booking.tilopayTransaction && (
            <DrawerRow icon={<DollarSign width={14} height={14} strokeWidth={1.5} />} label={t('drawer.tilopayTransaction')} value={booking.tilopayTransaction} />
          )}
          <DrawerRow
            icon={<CalendarDays width={14} height={14} strokeWidth={1.5} />}
            label={t('drawer.bookedOn')}
            value={format(inCostaRica(booking.createdAt), t('dates.dateTime'), { locale: dfLocale })}
          />
        </Section>

        {/* Class section */}
        {bookingClass && (
          <Section title={tc('labels.class')}>
            <p className="font-body text-sm font-medium text-ink mb-3">{bookingClass.name}</p>
            <DrawerRow
              icon={<CalendarDays width={14} height={14} strokeWidth={1.5} />}
              label={tc('labels.date')}
              value={t('drawer.classDate', {
                date: format(inCostaRica(bookingClass.startsAt), t('dates.dateTime'), { locale: dfLocale }),
              })}
            />
            <DrawerRow
              icon={<MapPin width={14} height={14} strokeWidth={1.5} />}
              label={tc('labels.people')}
              value={String(booking.persons)}
            />
          </Section>
        )}

        {/* Upsells */}
        {upsells.length > 0 && (
          <Section title={tc('labels.extras')}>
            <ul className="space-y-2">
              {upsells.map((u) => (
                <li key={u.id} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-body text-sm text-ink/70">
                    <DollarSign width={14} height={14} strokeWidth={1.5} className="text-ink/40" />
                    {u.name}
                  </span>
                  <span className="font-body text-sm font-medium text-ink">{tc('units.priceUsd', { amount: u.priceUsd })}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Total */}
        <div className="mt-10 flex justify-between items-center bg-burgundy text-cream px-5 py-4">
          <span className="font-body text-sm text-cream/70">{tc('labels.total')}</span>
          <span className="font-body text-lg font-medium text-cream">{tc('units.usd', { amount: total })}</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 pt-6 border-t border-ink/10">
      <p className="font-body text-[10px] tracking-[0.2em] uppercase text-ink/50 mb-4">
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DrawerRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-ink/40 flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-body text-[10px] tracking-[0.2em] uppercase text-ink/50">
          {label}
        </p>
        <p className="font-body text-sm text-ink mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}
