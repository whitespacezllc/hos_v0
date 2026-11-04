'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { addDays, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/routing';
import { dateFnsLocale } from '@/lib/dates';
import { costaRicaDateString, inCostaRica, nowInCostaRica } from '@/lib/costa-rica-time';
import { createAdminBooking } from '@/app/actions/bookings';
import { Modal } from '@/components/admin/Modal';
import { Input } from '@/components/admin/Input';
import { Button } from '@/components/admin/Button';
import AddParticipantModal, {
  type AddParticipantValues,
  type UpsellOption,
} from '@/components/admin/AddParticipantModal';

export type PickableClass = {
  id: string;
  name: string;
  startsAt: string;
  instructor?: string | null;
  spotsRemaining: number;
  priceUsd: number;
};

const toDayString = (day: Date) => format(day, 'yyyy-MM-dd');

// Adding a booking from the Bookings page. The same form and the same action as
// the calendar's drawer: this only adds the step the calendar gets for free,
// which is saying which class it's for. Any day can be picked, because the
// studio also records who came to a class that already happened.
export default function AddBookingFlow({
  open,
  onClose,
  classes,
  upsells,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  classes: PickableClass[];
  upsells: UpsellOption[];
  onAdded: () => void;
}) {
  const router = useRouter();
  const t = useTranslations('admin.bookings.picker');
  const tCalendar = useTranslations('admin.calendar');
  const tc = useTranslations('admin.common');
  const dfLocale = dateFnsLocale(useLocale() as AppLocale);

  const [day, setDay] = useState(() => toDayString(nowInCostaRica()));
  const [selected, setSelected] = useState<PickableClass | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const dayClasses = useMemo(
    () =>
      classes
        .filter((c) => costaRicaDateString(c.startsAt) === day)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [classes, day],
  );

  function shiftDay(by: number) {
    if (day) setDay(toDayString(addDays(parseISO(day), by)));
  }

  function close() {
    setSelected(null);
    setAddError(null);
    onClose();
  }

  async function handleSubmit(values: AddParticipantValues) {
    if (!selected) return;
    setIsAdding(true);
    setAddError(null);
    try {
      const res = await createAdminBooking({
        classId: selected.id,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        persons: values.persons,
        upsellIds: values.upsellIds,
        paymentMethod: values.paymentMethod,
        markPaid: values.markPaid,
        isHotelGuest: values.isHotelGuest,
        cloudbedsRef: values.cloudbedsRef,
      });
      if (!res.ok) {
        setAddError(
          res.error === 'no_spots_available'
            ? tCalendar('addErrors.noSpots')
            : res.error === 'class_not_found'
            ? tCalendar('addErrors.classNotFound')
            : tCalendar('addErrors.generic'),
        );
        return;
      }
      close();
      onAdded();
      router.refresh();
    } catch {
      setAddError(tCalendar('addErrors.generic'));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <>
      <Modal
        isOpen={open && !selected}
        onClose={close}
        title={t('title')}
        subtitle={t('subtitle')}
        footer={
          <Button variant="secondary" onClick={close}>
            {tc('actions.cancel')}
          </Button>
        }
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <Input
              id="add-booking-day"
              type="date"
              label={t('date')}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            aria-label={t('previousDay')}
            title={t('previousDay')}
            className="flex-none w-11 h-11 inline-flex items-center justify-center border border-ink/20 text-ink hover:bg-neutral-100 transition-colors duration-200 cursor-pointer"
          >
            <ChevronLeft width={18} height={18} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => shiftDay(1)}
            aria-label={t('nextDay')}
            title={t('nextDay')}
            className="flex-none w-11 h-11 inline-flex items-center justify-center border border-ink/20 text-ink hover:bg-neutral-100 transition-colors duration-200 cursor-pointer"
          >
            <ChevronRight width={18} height={18} strokeWidth={1.5} />
          </button>
        </div>

        {dayClasses.length === 0 ? (
          <p className="font-body text-sm text-ink/70 border border-dashed border-ink/20 px-4 py-6 text-center mt-5">
            {t('noClasses')}
          </p>
        ) : (
          <ul className="mt-5 space-y-2">
            {dayClasses.map((c) => {
              const full = c.spotsRemaining <= 0;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={full}
                    onClick={() => {
                      setAddError(null);
                      setSelected(c);
                    }}
                    className={`w-full flex items-center gap-4 px-4 py-3 border text-left transition-colors duration-200 ${
                      full
                        ? 'border-ink/10 text-ink/70 cursor-not-allowed'
                        : 'border-ink/20 text-ink hover:border-burgundy hover:bg-burgundy/5 cursor-pointer'
                    }`}
                  >
                    <span className="flex-none font-body text-sm font-medium w-12">
                      {format(inCostaRica(c.startsAt), 'HH:mm', { locale: dfLocale })}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-body text-sm font-medium truncate">{c.name}</span>
                      {c.instructor && (
                        <span className="block font-body text-xs text-ink/70 mt-0.5 truncate">{c.instructor}</span>
                      )}
                    </span>
                    <span className="flex-none font-body text-xs text-ink/70 text-right">
                      {full ? t('full') : t('spots', { count: c.spotsRemaining })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {selected && (
        <AddParticipantModal
          open={open}
          onOpenChange={(o) => {
            // Closing the form goes back to the list of classes, not out of it all.
            if (!o) {
              setSelected(null);
              setAddError(null);
            }
          }}
          onSubmit={handleSubmit}
          className={selected.name}
          spotsRemaining={selected.spotsRemaining}
          priceUsd={selected.priceUsd}
          upsells={upsells}
          loading={isAdding}
          error={addError}
        />
      )}
    </>
  );
}
