'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Package, Check, Mail, X, Copy, CalendarClock, Users, ArrowRight } from 'lucide-react';
import type { PackPurchase } from '@/lib/queries/packs';
import type { PackConfirmationReminder } from '@/types';
import { PageHeader } from '@/components/admin/PageHeader';
import { Badge } from '@/components/admin/Badge';
import { EmptyState } from '@/components/admin/EmptyState';
import { Modal } from '@/components/admin/Modal';
import { Button } from '@/components/admin/Button';
import { confirmPackPayment, resendPackCode, cancelPackPurchase } from '@/app/actions/packs';
import { confirmBooking } from '@/app/actions/bookings';

export default function PaquetesAdminClient({ purchases }: { purchases: PackPurchase[] }) {
  const router = useRouter();
  const t = useTranslations('admin.packs');
  const tc = useTranslations('admin.common');
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Reminder shown after confirming ANY pack payment: prompts the admin to
  // cross-check the Bookings section for this customer so pack usage stays
  // accurate. Includes a one-click confirm when a linked booking exists.
  const [reminder, setReminder] = useState<PackConfirmationReminder | null>(null);
  const [confirmingBooking, setConfirmingBooking] = useState(false);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleConfirm(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await confirmPackPayment(id);
      setBusyId(null);
      if (res.ok) {
        flash(
          res.emailSent
            ? t('toast.confirmedEmailed', { code: res.code ?? '' })
            : t('toast.confirmedNoEmail', { code: res.code ?? '' }),
        );
        // Always remind the admin to reconcile this customer against Bookings.
        // The list is refreshed when the reminder is dismissed (deferring the
        // refresh keeps it from racing the modal open).
        if (res.customer) {
          setReminder({ customer: res.customer, linkedBooking: res.linkedBooking ?? null });
        } else {
          router.refresh();
        }
      } else {
        flash(t('toast.confirmFailed'));
      }
    });
  }

  // Dismiss the reminder and refresh the list so the confirmed pack updates.
  function closeReminder() {
    setReminder(null);
    router.refresh();
  }

  function handleConfirmLinkedBooking() {
    if (!reminder?.linkedBooking) return;
    const bookingId = reminder.linkedBooking.id;
    setConfirmingBooking(true);
    startTransition(async () => {
      await confirmBooking(bookingId);
      setConfirmingBooking(false);
      setReminder(null);
      flash(t('toast.bookingConfirmed'));
      router.refresh();
    });
  }

  // Deep-link to Bookings pre-filtered by this customer's email so the admin can
  // compare and reconcile pack usage.
  const bookingsHref = reminder
    ? `/admin/reservas?q=${encodeURIComponent(reminder.customer.email)}`
    : '/admin/reservas';

  function handleResend(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await resendPackCode(id);
      setBusyId(null);
      flash(res.ok && res.emailSent ? t('toast.resent') : t('toast.resendFailed'));
    });
  }

  function handleCancel(id: string) {
    setBusyId(id);
    startTransition(async () => {
      await cancelPackPurchase(id);
      setBusyId(null);
      router.refresh();
    });
  }

  const pendingCount = purchases.filter((p) => p.status === 'pending').length;

  // Column headers live in admin.common.labels; the order is the table's.
  const headers = [
    tc('labels.customer'),
    tc('labels.pack'),
    tc('labels.code'),
    tc('labels.usage'),
    tc('labels.amount'),
    tc('labels.status'),
    tc('labels.actions'),
  ];

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-6xl mx-auto">
      <PageHeader
        heading={t('heading')}
        description={t('summary', { total: purchases.length, pending: pendingCount })}
      />

      {toast && (
        <div className="mb-6 px-4 py-3 bg-neutral-50 border border-ink/15 font-body text-sm text-ink">
          {toast}
        </div>
      )}

      {purchases.length === 0 ? (
        <EmptyState
          icon={<Package strokeWidth={1} />}
          heading={t('empty.heading')}
          description={t('empty.description')}
        />
      ) : (
        <div className="bg-white border border-ink/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-50 border-b border-ink/10">
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-4 py-3 font-body text-[10px] tracking-[0.2em] uppercase font-medium text-ink/50"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-ink/[0.08] last:border-0 hover:bg-neutral-50 transition-colors duration-200 align-middle"
                  >
                    <td className="px-4 py-4">
                      <p className="font-body text-sm font-medium text-ink">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="font-body text-xs text-ink/50 mt-0.5">{p.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-body text-sm text-ink">{p.packName}</span>
                    </td>
                    <td className="px-4 py-4">
                      {p.code ? (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(p.code!);
                            flash(t('toast.copied', { code: p.code ?? '' }));
                          }}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-ink bg-neutral-50 px-2 py-1 hover:bg-neutral-50 transition-colors cursor-pointer"
                          title={t('copyCode')}
                        >
                          {p.code}
                          <Copy width={12} height={12} strokeWidth={1.5} className="text-ink/40" />
                        </button>
                      ) : (
                        <span className="font-body text-sm text-ink/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-body text-sm text-ink">
                        {p.classesUsed}
                        <span className="text-ink/50">/{p.classesTotal}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-body text-sm text-ink">
                        {p.amountUsd != null ? `$${p.amountUsd}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={
                          p.status === 'paid'
                            ? 'active'
                            : p.status === 'pending'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {p.status === 'paid'
                          ? tc('status.paid')
                          : p.status === 'pending'
                          ? tc('status.awaitingPayment')
                          : tc('status.cancelled')}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {p.status === 'pending' && (
                          <>
                            <ActionButton
                              onClick={() => handleConfirm(p.id)}
                              disabled={isPending && busyId === p.id}
                              icon={<Check width={14} height={14} strokeWidth={1.5} />}
                              label={t('actions.confirmPayment')}
                            />
                            <IconButton
                              onClick={() => handleCancel(p.id)}
                              disabled={isPending && busyId === p.id}
                              ariaLabel={tc('actions.cancel')}
                              hoverDestructive
                            >
                              <X width={15} height={15} strokeWidth={1.5} />
                            </IconButton>
                          </>
                        )}
                        {p.status === 'paid' && (
                          <ActionButton
                            onClick={() => handleResend(p.id)}
                            disabled={isPending && busyId === p.id}
                            icon={<Mail width={14} height={14} strokeWidth={1.5} />}
                            label={t('actions.resendEmail')}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Reminder: reconcile this customer against Bookings ─────────────── */}
      <Modal
        isOpen={!!reminder}
        onClose={closeReminder}
        title={t('reminder.title')}
        subtitle={t('reminder.subtitle')}
        footer={
          <>
            <Button variant="secondary" onClick={closeReminder} disabled={confirmingBooking}>
              {tc('actions.done')}
            </Button>
            {reminder?.linkedBooking ? (
              <Button
                variant="primary"
                icon={<Check width={16} height={16} strokeWidth={1.5} />}
                onClick={handleConfirmLinkedBooking}
                loading={confirmingBooking}
              >
                {t('reminder.confirmBookingNow')}
              </Button>
            ) : (
              <Link href={bookingsHref} className="inline-flex">
                <Button
                  variant="primary"
                  icon={<ArrowRight width={16} height={16} strokeWidth={1.5} />}
                >
                  {t('reminder.goToBookings')}
                </Button>
              </Link>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {/* Customer to match */}
          <div className="flex items-start gap-3 p-4 bg-neutral-50 border border-ink/10">
            <Users width={18} height={18} strokeWidth={1.5} className="text-ink/50 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-body text-sm font-medium text-ink">
                {reminder?.customer.firstName} {reminder?.customer.lastName}
              </p>
              <p className="font-body text-xs text-ink/60 mt-0.5">{reminder?.customer.email}</p>
            </div>
          </div>

          <p className="font-body text-sm text-ink/70 leading-relaxed">
            {t.rich('reminder.body', { strong: (chunks: React.ReactNode) => <strong>{chunks}</strong> })}
          </p>

          {reminder?.linkedBooking ? (
            <div className="flex items-start gap-3 p-4 border border-burgundy/20 bg-burgundy/[0.04]">
              <CalendarClock width={18} height={18} strokeWidth={1.5} className="text-burgundy flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-body text-xs text-ink/60">
                  {t('reminder.linkedIntro')}
                </p>
                <p className="font-body text-sm font-medium text-ink mt-1">
                  {reminder.linkedBooking.className}
                </p>
                <p className="font-mono text-xs text-ink/60 mt-0.5">{reminder.linkedBooking.reference}</p>
                <p className="font-body text-xs text-ink/60 mt-2">
                  {t('reminder.linkedHint')}
                </p>
              </div>
            </div>
          ) : (
            <Link
              href={bookingsHref}
              className="inline-flex items-center gap-1.5 font-body text-sm text-burgundy hover:opacity-70 transition-opacity"
            >
              {t('reminder.openCustomer')}
              <ArrowRight width={14} height={14} strokeWidth={1.5} />
            </Link>
          )}
        </div>
      </Modal>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-ink/20 font-body text-xs text-ink hover:bg-neutral-50 transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon}
      {label}
    </button>
  );
}

function IconButton({
  children,
  onClick,
  ariaLabel,
  disabled,
  hoverDestructive = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  hoverDestructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`w-8 h-8 p-1.5 inline-flex items-center justify-center text-ink/60 hover:bg-neutral-50 ${
        hoverDestructive ? 'hover:text-burgundy' : 'hover:text-ink'
      } transition-colors duration-200 cursor-pointer disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
