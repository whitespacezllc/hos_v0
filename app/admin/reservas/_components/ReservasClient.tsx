'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
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
  Plus,
} from 'lucide-react';
import type { Booking } from '@/types';
import type { AppLocale } from '@/i18n/routing';
import { dateFnsLocale } from '@/lib/dates';
import { PageContainer } from '@/components/admin/PageContainer';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Badge } from '@/components/admin/Badge';
import { EmptyState } from '@/components/admin/EmptyState';
import { DeleteConfirmation } from '@/components/admin/DeleteConfirmation';
import { NativeSelect } from '@/components/admin/NativeSelect';
import { RowIconButton } from '@/components/admin/RowIconButton';
import { DateFilter } from '@/components/admin/DateFilter';
import { Drawer } from '@/components/admin/Drawer';
import AddBookingFlow, { type PickableClass } from './AddBookingFlow';
import type { UpsellOption } from '@/components/admin/AddParticipantModal';
import { confirmBooking, cancelBookingAdmin } from '@/app/actions/bookings';
import type { CancelledBy } from '@/lib/checkout/cancel';
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
const PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════════════════
export default function ReservasClient({
  initialBookings,
  classMap,
  upsellMap,
  pickableClasses,
  upsellOptions,
}: {
  initialBookings: SerializedBooking[];
  classMap: Record<string, ClassInfo>;
  upsellMap: Record<string, UpsellInfo>;
  /** The classes a booking can be added to from here. */
  pickableClasses: PickableClass[];
  upsellOptions: UpsellOption[];
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
  // The date range reads the class's date or the day it was booked. By class
  // is the everyday question: who is coming on Friday?
  const [dateField, setDateField] = useState<'class' | 'booked'>('class');
  const [fromDate, setFromDate] = useState(''); // YYYY-MM-DD, in Costa Rica
  const [toDate, setToDate] = useState('');

  // Pagination.
  const [page, setPage] = useState(1);

  // Drawer + delete
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<SerializedBooking | null>(null);
  const [cancelledBy, setCancelledBy] = useState<CancelledBy | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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
        if (fromDate || toDate) {
          const clase = classMap[b.classId];
          const day =
            dateField === 'booked'
              ? costaRicaDateString(b.createdAt)
              : clase
              ? costaRicaDateString(clase.startsAt)
              : null;
          if (!day) return false;
          if (fromDate && day < fromDate) return false;
          if (toDate && day > toDate) return false;
        }
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
      .sort((a, b) => {
        // Looking at a span of class dates, the list reads like the schedule:
        // first class first. Otherwise, the latest booking on top.
        if (dateField === 'class' && (fromDate || toDate)) {
          const byClass =
            new Date(classMap[a.classId]?.startsAt ?? 0).getTime() -
            new Date(classMap[b.classId]?.startsAt ?? 0).getTime();
          if (byClass !== 0) return byClass;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [initialBookings, classMap, search, statusFilter, classFilter, dateField, fromDate, toDate]);

  // Reset to the first page whenever the result set changes (filters/search).
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, classFilter, dateField, fromDate, toDate]);

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
    setDateField('class');
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

  function askToCancel(b: SerializedBooking) {
    setCancelledBy(null);
    setCancelError(null);
    setCancelTarget(b);
  }

  async function handleConfirmCancel() {
    if (!cancelTarget || !cancelledBy) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await cancelBookingAdmin(cancelTarget.id, cancelledBy);
      setNotice(res.emailSent ? null : t('cancelDialog.emailFailed', { email: cancelTarget.email }));
      setCancelTarget(null);
      setDrawerOpen(false);
      router.refresh();
    } catch {
      setCancelError(tc('feedback.somethingWentWrong'));
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

  const addButton = (
    <Button
      variant="primary"
      icon={<Plus width={16} height={16} strokeWidth={1.5} />}
      onClick={() => setAddOpen(true)}
    >
      {t('addBooking')}
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        heading={t('heading')}
        description={tc('units.bookings', { count: initialBookings.length })}
        actions={addButton}
      />

      {notice && (
        <p role="alert" className="mb-6 font-body text-sm px-4 py-3 border text-burgundy border-burgundy/30 bg-burgundy/5">
          {notice}
        </p>
      )}

      {initialBookings.length === 0 ? (
        <EmptyState
          icon={<UsersIcon strokeWidth={1} />}
          heading={t('empty.heading')}
          description={t('empty.description')}
          action={addButton}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end md:gap-4">
            <div className="relative col-span-2 md:flex-1 md:min-w-[240px] md:max-w-sm">
              <Search
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/60 pointer-events-none"
                width={16}
                height={16}
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('filters.searchPlaceholder')}
                aria-label={t('filters.searchPlaceholder')}
                className="block w-full h-10 pl-9 pr-3 bg-white border border-ink/20 font-body text-base md:text-sm text-ink outline-none focus:border-ink transition-colors duration-200 placeholder:text-ink/50"
              />
            </div>
            <NativeSelect
              filter
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              options={classOptions}
              aria-label={t('filters.byClass')}
              className="w-full md:w-auto md:max-w-[14rem]"
            />
            <NativeSelect
              filter
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
              aria-label={t('filters.byStatus')}
              className="w-full md:w-auto"
            />
            <label className="col-span-2 md:col-auto flex flex-col gap-1.5 min-w-0">
              <span className="font-body text-xs text-ink/70">{t('filters.dateField')}</span>
              <NativeSelect
                filter
                value={dateField}
                onChange={(e) => setDateField(e.target.value as 'class' | 'booked')}
                options={[
                  { value: 'class', label: t('filters.classDate') },
                  { value: 'booked', label: t('filters.bookedDate') },
                ]}
                className="w-full md:w-auto"
              />
            </label>
            <DateFilter
              label={t('filters.from')}
              ariaLabel={t('filters.fromDate')}
              emptyLabel={t('filters.anyDate')}
              value={fromDate}
              max={toDate || undefined}
              onChange={setFromDate}
            />
            <DateFilter
              label={t('filters.to')}
              ariaLabel={t('filters.toDate')}
              emptyLabel={t('filters.anyDate')}
              value={toDate}
              min={fromDate || undefined}
              onChange={setToDate}
            />
            {filtersActive && (
              <Button variant="tertiary" onClick={clearFilters} className="col-span-2 md:ml-auto">
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
              <BookingCards
                bookings={paginated}
                classMap={classMap}
                onView={openDetail}
              />
              <BookingsTable
                bookings={paginated}
                classMap={classMap}
                onView={openDetail}
                onCancel={askToCancel}
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
      <Drawer
        isOpen={drawerOpen && !!selectedBooking}
        onClose={() => setDrawerOpen(false)}
        ariaLabel={t('drawer.title')}
      >
        {selectedBooking && (
          <BookingDrawerContent
            booking={selectedBooking}
            bookingClass={selectedClass}
            upsells={selectedUpsells}
            total={selectedTotal}
            isPending={isPending}
            onClose={() => setDrawerOpen(false)}
            onConfirmPayment={() => handleConfirmPayment(selectedBooking.id)}
            onCancel={() => askToCancel(selectedBooking)}
          />
        )}
      </Drawer>

      <DeleteConfirmation
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title={t('cancelDialog.title')}
        description={t('cancelDialog.description')}
        confirmLabel={t('actions.cancelBooking')}
        cancelLabel={t('cancelDialog.keep')}
        loading={isCancelling}
        error={cancelError}
        confirmDisabled={!cancelledBy}
      >
        {/* Which email goes out depends on this, and it can't be taken back, so
            there's no default: the answer has to be given. */}
        <fieldset className="mt-5">
          <legend className="font-body text-sm font-medium text-ink mb-2">{t('cancelDialog.who')}</legend>
          <div className="space-y-2">
            {(['studio', 'customer'] as const).map((who) => (
              <label
                key={who}
                className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors duration-200 ${
                  cancelledBy === who ? 'border-burgundy bg-burgundy/5' : 'border-ink/20 hover:border-ink/40'
                }`}
              >
                <input
                  type="radio"
                  name="cancelled-by"
                  value={who}
                  checked={cancelledBy === who}
                  onChange={() => setCancelledBy(who)}
                  className="mt-0.5 accent-[#8D0000] flex-shrink-0"
                />
                <span className="min-w-0">
                  <span className="block font-body text-sm text-ink">{t(`cancelDialog.${who}`)}</span>
                  <span className="block font-body text-xs text-ink/70 mt-0.5">{t(`cancelDialog.${who}Hint`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </DeleteConfirmation>

      <AddBookingFlow
        open={addOpen}
        onClose={() => setAddOpen(false)}
        classes={pickableClasses}
        upsells={upsellOptions}
        onAdded={() => {
          // The new booking goes to the top of the list: make sure no filter
          // hides it.
          clearFilters();
          setPage(1);
        }}
      />
    </PageContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Phone — one card per booking (the table takes over from `md`)
// ═══════════════════════════════════════════════════════════════════════════
function BookingCards({
  bookings,
  classMap,
  onView,
}: {
  bookings: SerializedBooking[];
  classMap: Record<string, ClassInfo>;
  onView: (b: SerializedBooking) => void;
}) {
  const t = useTranslations('admin.bookings');
  const tc = useTranslations('admin.common');
  const dfLocale = dateFnsLocale(useLocale() as AppLocale);
  const paymentBadge = usePaymentBadge();

  return (
    <ul className="md:hidden space-y-3">
      {bookings.map((b) => {
        const clase = classMap[b.classId];
        const badge = paymentBadge(b.paymentStatus);
        const isPending = b.paymentStatus === 'pending';
        return (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onView(b)}
              className={`w-full text-left p-4 border cursor-pointer transition-colors duration-200 ${
                isPending
                  ? 'bg-amber-50/70 border-amber-500/60 border-l-2 border-l-amber-500'
                  : 'bg-white border-ink/10 active:bg-neutral-50'
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-body text-sm font-medium text-ink truncate">
                    {b.firstName} {b.lastName}
                  </span>
                  <span className="block font-body text-xs text-ink/70 mt-0.5 truncate">{b.email}</span>
                </span>
                <Badge variant={badge.variant} className="flex-shrink-0">{badge.label}</Badge>
              </span>
              <span className="mt-3 flex items-baseline justify-between gap-3">
                <span className="min-w-0 font-body text-sm text-ink truncate">{b.className}</span>
                {clase && (
                  <span className="flex-shrink-0 font-body text-xs text-ink/70">
                    {format(inCostaRica(clase.startsAt), t('dates.classShort'), { locale: dfLocale })}
                  </span>
                )}
              </span>
              <span className="mt-2 flex items-baseline justify-between gap-3 font-body text-xs text-ink/70">
                <span>
                  {tc(`paymentMethod.${paymentMethodKey(b.paymentMethod)}`)}
                  {b.persons > 1 && ` · ${t('table.people', { count: b.persons })}`}
                </span>
                <span className="font-body text-sm font-medium text-ink">
                  {tc('units.priceUsd', { amount: bookingTotal(b) })}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Table
// ═══════════════════════════════════════════════════════════════════════════
function BookingsTable({
  bookings,
  classMap,
  onView,
  onCancel,
}: {
  bookings: SerializedBooking[];
  classMap: Record<string, ClassInfo>;
  onView: (b: SerializedBooking) => void;
  onCancel: (b: SerializedBooking) => void;
}) {
  const t = useTranslations('admin.bookings');
  const tc = useTranslations('admin.common');
  const dfLocale = dateFnsLocale(useLocale() as AppLocale);
  const paymentBadge = usePaymentBadge();

  // What fits decides what shows: the code and the booking date join from
  // `xl`, the head count from `2xl`. All of it is always one click away in the
  // drawer, and more than one person is noted under the total meanwhile.
  const headers = [
    { label: tc('labels.code'), className: 'hidden xl:table-cell' },
    { label: tc('labels.student'), className: '' },
    { label: tc('labels.class'), className: '' },
    { label: t('drawer.bookedOn'), className: 'hidden xl:table-cell' },
    { label: tc('labels.people'), className: 'hidden 2xl:table-cell' },
    { label: tc('labels.total'), className: '' },
    { label: tc('labels.status'), className: '' },
    { label: '', className: '' },
  ];

  return (
    <div className="hidden md:block bg-white border border-ink/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-50 border-b border-ink/10">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`text-left px-3 py-3 font-body text-xs font-medium text-ink/70 whitespace-nowrap ${h.className}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const clase = classMap[b.classId];
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
                      ? 'bg-amber-50/70 hover:bg-amber-100/70'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  <td className="px-3 py-3 hidden xl:table-cell">
                    <span
                      className={`font-mono text-xs px-2 py-0.5 whitespace-nowrap ${
                        isPending ? 'text-amber-900 bg-amber-100/60' : 'text-ink/80 bg-neutral-50'
                      }`}
                    >
                      {b.bookingReference}
                    </span>
                  </td>
                  <td className="px-3 py-3 max-w-[14rem] 2xl:max-w-[18rem]">
                    <p className="font-body text-sm font-medium text-ink truncate">
                      {b.firstName} {b.lastName}
                    </p>
                    <p className="font-body text-xs text-ink/70 mt-0.5 truncate">
                      {b.email}
                    </p>
                  </td>
                  <td className="px-3 py-3 max-w-[12rem] 2xl:max-w-[16rem]">
                    <p className="font-body text-sm text-ink truncate">{b.className}</p>
                    {clase && (
                      <p className="font-body text-xs text-ink/70 mt-0.5 whitespace-nowrap">
                        {format(inCostaRica(clase.startsAt), t('dates.classShort'), { locale: dfLocale })}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden xl:table-cell">
                    <span className="font-body text-sm text-ink/80 whitespace-nowrap">
                      {format(inCostaRica(b.createdAt), t('dates.dateShort'), { locale: dfLocale })}
                    </span>
                  </td>
                  <td className="px-3 py-3 hidden 2xl:table-cell">
                    <span className="font-body text-sm text-ink">{b.persons}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-body text-sm font-medium text-ink whitespace-nowrap">{tc('units.priceUsd', { amount: total })}</span>
                    {b.persons > 1 && (
                      <p className="font-body text-xs text-ink/70 mt-0.5 whitespace-nowrap 2xl:hidden">
                        {t('table.people', { count: b.persons })}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <p className="font-body text-xs text-ink/70 mt-1">
                      {tc(`paymentMethod.${paymentMethodKey(b.paymentMethod)}`)}
                    </p>
                  </td>
                  <td className="px-3 py-3">
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
      <p className="font-body text-xs text-ink/70">
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
              className="px-2 font-body text-sm text-ink/70 select-none"
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
      <div className="sticky top-0 z-10 bg-white flex justify-between items-center px-5 sm:px-6 py-3 border-b border-ink/10">
        <span className="font-mono text-xs text-ink/80 bg-neutral-50 px-2 py-0.5">
          {booking.bookingReference}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('drawer.close')}
          className="w-10 h-10 -mr-2 inline-flex items-center justify-center text-ink hover:opacity-70 transition-opacity duration-200 cursor-pointer"
        >
          <X width={20} height={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 sm:px-6 py-6">
        <h2 className="font-body text-xl font-medium text-ink leading-tight break-words">
          {booking.firstName} {booking.lastName}
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span className="font-body text-sm text-ink/70">
            {tc(`paymentMethod.${paymentMethodKey(booking.paymentMethod)}`)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-6">
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
                    <DollarSign width={14} height={14} strokeWidth={1.5} className="text-ink/60" />
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
      <p className="font-body text-sm font-medium text-ink mb-4">
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
      <span className="text-ink/60 flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-body text-xs text-ink/70">
          {label}
        </p>
        <p className="font-body text-sm text-ink mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}
