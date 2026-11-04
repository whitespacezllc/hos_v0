'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { format, isSameDay } from 'date-fns';
import { costaRicaWeekDays, inCostaRica, nowInCostaRica } from '@/lib/costa-rica-time';
import { dateFnsLocale } from '@/lib/dates';
import type { AppLocale } from '@/i18n/routing';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  DollarSign,
  User,
  Pencil,
  Trash2,
  CalendarX,
  UserPlus,
} from 'lucide-react';
import type { YogaClass, Booking, ClassInstancePayload } from '@/types';
import {
  deleteClass,
  createClassInstance,
  updateClassInstance,
} from '@/app/actions/classes';
import { createAdminBooking } from '@/app/actions/bookings';
import { Button } from '@/components/admin/Button';
import { PageContainer } from '@/components/admin/PageContainer';
import { Drawer } from '@/components/admin/Drawer';
import { Badge } from '@/components/admin/Badge';
import { EmptyState } from '@/components/admin/EmptyState';
import { DeleteConfirmation } from '@/components/admin/DeleteConfirmation';
import CalendarClassModal, {
  type EditableInstance,
} from '@/components/admin/CalendarClassModal';
import AddParticipantModal, {
  type AddParticipantValues,
  type UpsellOption,
} from '@/components/admin/AddParticipantModal';

// ─── Category palette — mirrors /app/yoga/YogaPageClient.tsx exactly so the
// admin calendar reads the same color language students see on the public site.
// The label is a catalogue key (admin.calendar.category.*).
type CategoryKey = 'flow-vinyasa' | 'yin-restorative' | 'hatha-gentle' | 'ashtanga-intense' | 'meditation';
type CategoryStyle = { stripe: string; label: CategoryKey };

const CATEGORY_STYLES: Record<CategoryKey, CategoryStyle> = {
  'flow-vinyasa':     { stripe: '#8B6F47', label: 'flow-vinyasa' },     // terracotta
  'yin-restorative':  { stripe: '#6B7355', label: 'yin-restorative' },  // olive
  'hatha-gentle':     { stripe: '#A6896D', label: 'hatha-gentle' },     // sand
  'ashtanga-intense': { stripe: '#5A3E2B', label: 'ashtanga-intense' }, // deep earth
  'meditation':       { stripe: '#7A6B5D', label: 'meditation' },       // warm gray
};

function getCategoryKey(name: string): CategoryKey {
  if (['Sunrise Vinyasa', 'Power Flow', 'Breath & Movement', 'Vinyasa Flow', 'Vinyasa Krama', 'Detox Yoga'].includes(name)) return 'flow-vinyasa';
  if (['Yin Yoga', 'Yin & Restore', 'Restorative Yoga', 'Deep Stretch & Breath'].includes(name)) return 'yin-restorative';
  if (['Gentle Flow', 'Hatha Foundations'].includes(name)) return 'hatha-gentle';
  if (['Ashtanga Primary'].includes(name)) return 'ashtanga-intense';
  if (['Pranayama & Meditación', 'Meditation', 'Tantra Vinyasa'].includes(name)) return 'meditation';
  return 'flow-vinyasa';
}

function categoryFor(name: string): CategoryStyle {
  return CATEGORY_STYLES[getCategoryKey(name)];
}

// ─── Grid constants ─────────────────────────────────────────────────────────
const GRID_START_HOUR = 6;
const GRID_END_HOUR = 22;
const HOUR_PX = 64;
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;

const timeLabels = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
  (_, i) => `${String(GRID_START_HOUR + i).padStart(2, '0')}:00`,
);

type SerializedClass = Omit<YogaClass, 'startsAt'> & { startsAt: string };
type SerializedBooking = Omit<Booking, 'createdAt'> & { createdAt: string };

function classTopPx(startsAt: string): number {
  const d = inCostaRica(startsAt);
  const minutes = d.getHours() * 60 + d.getMinutes() - GRID_START_HOUR * 60;
  return Math.max(0, (minutes / 60) * HOUR_PX);
}

// yyyy-MM-dd for a day (the calendar's days are Costa Rica's).
function localDateStr(day: Date): string {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Classes that overlap in a day share its width, side by side, instead of being
// drawn on top of each other. A short class counts for the height its card takes.
type PlacedClass = { clase: SerializedClass; column: number; columns: number };

function placeOverlaps(classes: SerializedClass[]): PlacedClass[] {
  const minutes = (c: SerializedClass) => new Date(c.startsAt).getTime() / 60_000;
  const end = (c: SerializedClass) => minutes(c) + Math.max(c.durationMinutes ?? 60, 45);
  const sorted = [...classes].sort((a, b) => minutes(a) - minutes(b));

  const placed: PlacedClass[] = [];
  let group: { clase: SerializedClass; column: number }[] = [];
  let columnEnds: number[] = [];
  const flush = () => {
    group.forEach((g) => placed.push({ ...g, columns: columnEnds.length }));
    group = [];
    columnEnds = [];
  };
  for (const clase of sorted) {
    if (columnEnds.length > 0 && minutes(clase) >= Math.max(...columnEnds)) flush();
    let column = columnEnds.findIndex((e) => e <= minutes(clase));
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = end(clase);
    group.push({ clase, column });
  }
  flush();
  return placed;
}

// Converts a vertical click offset in a day column into a HH:mm start time,
// snapped to 30-minute increments and clamped to the visible grid range.
function timeFromOffsetY(offsetY: number): string {
  const totalMin = GRID_START_HOUR * 60 + (offsetY / HOUR_PX) * 60;
  const snapped = Math.round(totalMin / 30) * 30;
  const clamped = Math.min(GRID_END_HOUR * 60, Math.max(GRID_START_HOUR * 60, snapped));
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Map payment status → Badge variant + display label (a key of
// admin.common.status; an unknown status shows its raw value).
function paymentBadgeFor(status: string): {
  variant: 'active' | 'warning' | 'inactive' | 'destructive' | 'neutral';
  labelKey: 'paid' | 'pending' | 'cancelled' | 'noShow' | 'free' | null;
} {
  switch (status) {
    case 'paid':
      return { variant: 'active', labelKey: 'paid' };
    case 'pending':
      return { variant: 'warning', labelKey: 'pending' };
    case 'cancelled':
      return { variant: 'inactive', labelKey: 'cancelled' };
    case 'no-show':
      return { variant: 'destructive', labelKey: 'noShow' };
    case 'free':
      return { variant: 'neutral', labelKey: 'free' };
    default:
      return { variant: 'neutral', labelKey: null };
  }
}

// date-fns `es` keeps weekday and month names lowercase; a label that starts
// with one reads better capitalized. Harmless in English.
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════
export default function CalendarioClient({
  initialClasses,
  initialBookings,
  instructors,
  upsells,
  standardPriceUsd,
}: {
  initialClasses: SerializedClass[];
  initialBookings: SerializedBooking[];
  instructors: { id: string; name: string }[];
  upsells: UpsellOption[];
  /** The standard drop-in price, a new class's starting point. */
  standardPriceUsd: number;
}) {
  const router = useRouter();
  const t = useTranslations('admin.calendar');
  const tc = useTranslations('admin.common');
  const dfLocale = dateFnsLocale(useLocale() as AppLocale);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedClass, setSelectedClass] = useState<SerializedClass | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create / edit class modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editInstance, setEditInstance] = useState<EditableInstance | undefined>();
  const [createPrefill, setCreatePrefill] = useState<{ date: string; time: string } | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  // Add-participant modal (manual walk-in registration from the drawer).
  const [addOpen, setAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteAudience, setDeleteAudience] = useState(0);
  // What a delete leaves to say: who was told, or who couldn't be.
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  // Mobile: which day index (0–6) is currently visible. Defaults to today if
  // today is within the displayed week, otherwise 0 (Monday).
  const [mobileDayIdx, setMobileDayIdx] = useState(0);

  // Monday to Sunday in Santa Teresa, whatever the admin's own clock says.
  const weekDays = useMemo(() => costaRicaWeekDays(weekOffset), [weekOffset]);

  // Whenever the week changes, jump mobile selector to today if it's in view.
  useEffect(() => {
    const todayIdx = weekDays.findIndex((d) => isSameDay(d, nowInCostaRica()));
    setMobileDayIdx(todayIdx >= 0 ? todayIdx : 0);
  }, [weekDays]);

  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, t('weekRange.sameMonthStart'), { locale: dfLocale })} — ${format(end, t('weekRange.sameMonthEnd'), { locale: dfLocale })}`;
    }
    return `${format(start, t('weekRange.otherMonthStart'), { locale: dfLocale })} — ${format(end, t('weekRange.otherMonthEnd'), { locale: dfLocale })}`;
  }, [weekDays, t, dfLocale]);

  const classMap = useMemo(() => {
    const map = new Map<number, SerializedClass[]>();
    weekDays.forEach((_, i) => map.set(i, []));
    initialClasses
      .filter((c) => c.isActive)
      .forEach((c) => {
        const dayIdx = weekDays.findIndex((d) => isSameDay(inCostaRica(c.startsAt), d));
        if (dayIdx !== -1) map.get(dayIdx)!.push(c);
      });
    return map;
  }, [weekDays, initialClasses]);

  const totalClassesInWeek = useMemo(
    () => Array.from(classMap.values()).reduce((acc, arr) => acc + arr.length, 0),
    [classMap],
  );

  const classBookings = useMemo(
    () => (selectedClass ? initialBookings.filter((b) => b.classId === selectedClass.id) : []),
    [selectedClass, initialBookings],
  );

  const occupied = selectedClass ? selectedClass.capacity - selectedClass.spotsRemaining : 0;
  const occupancyPct = selectedClass
    ? Math.min(100, (occupied / selectedClass.capacity) * 100)
    : 0;

  function openDrawer(c: SerializedClass) {
    setSelectedClass(c);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    // Keep selectedClass briefly so exit animation can read its content
    setTimeout(() => setSelectedClass((cur) => (drawerOpen ? cur : null)), 250);
  }

  function openDelete() {
    setDeleteError(null);
    // Who it would reach: live bookings, if the class is still to come.
    setDeleteAudience(
      selectedClass && new Date(selectedClass.startsAt).getTime() > Date.now()
        ? classBookings.filter((b) => b.paymentStatus !== 'cancelled' && b.paymentStatus !== 'no-show').length
        : 0,
    );
    setDeleteOpen(true);
  }

  async function handleConfirmDelete() {
    if (!selectedClass) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteClass(selectedClass.id);
      if (!res.ok) {
        setDeleteError(
          res.error === 'not_admin' ? tc('feedback.signedInRequired') : tc('feedback.couldNotDelete'),
        );
        return;
      }
      setNotice(
        res.emailsFailed > 0
          ? { tone: 'error', text: t('deleteDialog.emailsFailed', { count: res.emailsFailed }) }
          : res.cancelled > 0
          ? { tone: 'info', text: t('deleteDialog.notified', { count: res.cancelled }) }
          : null,
      );
      setDeleteOpen(false);
      setDrawerOpen(false);
      setSelectedClass(null);
      router.refresh();
    } catch {
      setDeleteError(tc('feedback.couldNotDelete'));
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Create / edit ──────────────────────────────────────────────────────────
  function openCreate(prefill?: { date: string; time: string }) {
    setSaveError(null);
    setModalMode('create');
    setEditInstance(undefined);
    setCreatePrefill(prefill);
    setModalOpen(true);
  }

  function openEditFromDrawer() {
    if (!selectedClass) return;
    setSaveError(null);
    setModalMode('edit');
    setEditInstance({
      name: selectedClass.name,
      description: selectedClass.description,
      instructorId: selectedClass.instructorId,
      startsAt: selectedClass.startsAt,
      durationMinutes: selectedClass.durationMinutes,
      capacity: selectedClass.capacity,
      priceUsd: selectedClass.priceUsd,
      location: selectedClass.location,
      imageUrl: selectedClass.imageUrl,
      isActive: selectedClass.isActive,
    });
    setDrawerOpen(false);
    setModalOpen(true);
  }

  // ── Add participant ──────────────────────────────────────────────────────
  function openAddParticipant() {
    setAddError(null);
    setAddOpen(true);
  }

  async function handleAddParticipant(values: AddParticipantValues) {
    if (!selectedClass) return;
    setIsAdding(true);
    setAddError(null);
    try {
      const res = await createAdminBooking({
        classId: selectedClass.id,
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
            ? t('addErrors.noSpots')
            : res.error === 'class_not_found'
            ? t('addErrors.classNotFound')
            : t('addErrors.generic'),
        );
        return;
      }
      setAddOpen(false);
      // Close the drawer so the refreshed occupancy/bookings reload cleanly.
      setDrawerOpen(false);
      setSelectedClass(null);
      router.refresh();
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSaveClass(payload: ClassInstancePayload) {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res =
        modalMode === 'edit' && selectedClass
          ? await updateClassInstance(selectedClass.id, payload)
          : await createClassInstance(payload);
      if (!res.ok) {
        setSaveError(
          res.error === 'not_admin' ? tc('feedback.signedInRequired') : tc('feedback.couldNotSave'),
        );
        return;
      }
      setModalOpen(false);
      setSelectedClass(null);
      router.refresh();
    } catch {
      setSaveError(tc('feedback.couldNotSave'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageContainer>
      {/* ─── Header row ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-center gap-3 sm:gap-4">
        {/* Week navigation */}
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              aria-label={t('header.previousWeek')}
              className="w-10 h-10 -ml-2 inline-flex items-center justify-center text-ink hover:bg-neutral-100 transition-colors duration-200 cursor-pointer"
            >
              <ChevronLeft width={18} height={18} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="px-3 h-10 border border-ink/20 font-body text-sm text-ink hover:bg-neutral-100 transition-colors duration-200 cursor-pointer"
            >
              {tc('labels.today')}
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              aria-label={t('header.nextWeek')}
              className="w-10 h-10 inline-flex items-center justify-center text-ink hover:bg-neutral-100 transition-colors duration-200 cursor-pointer"
            >
              <ChevronRight width={18} height={18} strokeWidth={1.5} />
            </button>
          </div>
          <h1 className="font-body text-base lg:text-lg font-medium text-ink truncate">{weekLabel}</h1>
        </div>

        {/* Manage the recurring schedule / add a one-off class */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button
            variant="secondary"
            onClick={() => router.push('/admin/clases')}
          >
            {t('header.manageClasses')}
          </Button>
          <Button
            variant="primary"
            icon={<Plus width={16} height={16} strokeWidth={1.5} />}
            onClick={() => openCreate()}
          >
            {t('header.newClass')}
          </Button>
        </div>
      </div>

      {notice && (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mb-5 font-body text-sm px-4 py-3 border ${
            notice.tone === 'error'
              ? 'text-burgundy border-burgundy/30 bg-burgundy/5'
              : 'text-ink/80 border-ink/20 bg-white'
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* ─── Grid OR empty state ────────────────────────────────────────── */}
      {totalClassesInWeek === 0 ? (
        <EmptyState
          icon={<CalendarX strokeWidth={1} />}
          heading={t('empty.heading')}
          description={t('empty.description')}
          action={
            <Button
              variant="primary"
              icon={<Plus width={16} height={16} strokeWidth={1.5} />}
              onClick={() => openCreate({ date: localDateStr(weekDays[0]), time: '10:00' })}
            >
              {t('header.newClass')}
            </Button>
          }
        />
      ) : (
        <>
          {/* Mobile: day selector + single-day list */}
          <div className="md:hidden">
            <MobileDaySelector
              days={weekDays}
              selected={mobileDayIdx}
              onSelect={setMobileDayIdx}
            />
            <MobileDayList
              classes={classMap.get(mobileDayIdx) ?? []}
              onSelect={openDrawer}
              onCreate={() =>
                openCreate({ date: localDateStr(weekDays[mobileDayIdx]), time: '10:00' })
              }
            />
          </div>

          {/* Desktop / tablet: full 7-day grid. It scrolls inside its own frame
              so the days stay on top and the hours on the left, however far
              down the day has gone. */}
          <div className="hidden md:block overflow-auto overscroll-contain max-h-[calc(100dvh-11.5rem)] lg:max-h-[calc(100dvh-9.5rem)] xl:max-h-[calc(100dvh-10.5rem)] border border-ink/10 bg-white">
            <DesktopWeekGrid
              days={weekDays}
              classMap={classMap}
              onSelect={openDrawer}
              onCreate={(day, offsetY) =>
                openCreate({ date: localDateStr(day), time: timeFromOffsetY(offsetY) })
              }
            />
          </div>
        </>
      )}

      {/* ─── Drawer ─────────────────────────────────────────────────────── */}
      <Drawer
        isOpen={drawerOpen && !!selectedClass}
        onClose={() => setDrawerOpen(false)}
        ariaLabel={t('drawer.ariaLabel')}
      >
        {selectedClass && (
          <DrawerContent
            clase={selectedClass}
            bookings={classBookings}
            occupied={occupied}
            occupancyPct={occupancyPct}
            onClose={() => setDrawerOpen(false)}
            onEdit={openEditFromDrawer}
            onDelete={() => openDelete()}
            onAddParticipant={openAddParticipant}
          />
        )}
      </Drawer>

      {/* ─── Delete confirmation ────────────────────────────────────────── */}
      <DeleteConfirmation
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t('deleteDialog.title')}
        description={
          deleteAudience > 0
            ? t('deleteDialog.withBookings', { count: deleteAudience })
            : t('deleteDialog.description')
        }
        confirmLabel={deleteAudience > 0 ? t('deleteDialog.confirmAndNotify') : t('deleteDialog.confirm')}
        loading={isDeleting}
        error={deleteError}
      />

      {/* ─── Create / edit class modal ──────────────────────────────────── */}
      <CalendarClassModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSaveClass}
        mode={modalMode}
        instructors={instructors}
        instance={editInstance}
        prefill={createPrefill}
        loading={isSaving}
        error={saveError}
        standardPriceUsd={standardPriceUsd}
      />

      {/* ─── Add participant modal ──────────────────────────────────────── */}
      {selectedClass && (
        <AddParticipantModal
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o);
            if (!o) setAddError(null);
          }}
          onSubmit={handleAddParticipant}
          className={selectedClass.name}
          spotsRemaining={selectedClass.spotsRemaining}
          priceUsd={selectedClass.priceUsd}
          upsells={upsells}
          loading={isAdding}
          error={addError}
        />
      )}
    </PageContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Desktop / tablet — 7-day grid
// ═══════════════════════════════════════════════════════════════════════════
function DesktopWeekGrid({
  days,
  classMap,
  onSelect,
  onCreate,
}: {
  days: Date[];
  classMap: Map<number, SerializedClass[]>;
  onSelect: (c: SerializedClass) => void;
  onCreate: (day: Date, offsetY: number) => void;
}) {
  const t = useTranslations('admin.calendar');
  return (
    <div className="grid grid-cols-[44px_repeat(7,minmax(80px,1fr))] gap-x-1 xl:gap-x-2 pr-1 xl:pr-2 min-w-[660px]">
      {/* Top-left empty cell */}
      <div className="sticky left-0 top-0 z-20 bg-white" />
      {/* Day headers */}
      {days.map((day) => (
        <DayHeader key={day.toISOString()} day={day} />
      ))}

      {/* Time column */}
      <div className="sticky left-0 z-10 bg-white relative" style={{ height: GRID_HEIGHT }}>
        {timeLabels.slice(0, -1).map((label, i) => (
          <div
            key={label}
            className="absolute right-1.5 font-body text-[11px] text-ink/60"
            style={{ top: i === 0 ? 0 : i * HOUR_PX - 7 }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day columns */}
      {days.map((day, dayIdx) => (
        <div
          key={day.toISOString()}
          className="relative cursor-pointer group/col"
          style={{ height: GRID_HEIGHT }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onCreate(day, e.clientY - rect.top);
          }}
          title={t('grid.clickToAdd')}
        >
          {/* Hourly horizontal lines */}
          {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className="absolute left-0 right-0 border-t border-ink/5"
              style={{ top: i * HOUR_PX }}
            />
          ))}
          {placeOverlaps(classMap.get(dayIdx) ?? []).map(({ clase, column, columns }) => (
            <CalendarClassCard
              key={clase.id}
              clase={clase}
              column={column}
              columns={columns}
              onClick={() => onSelect(clase)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function DayHeader({ day }: { day: Date }) {
  const t = useTranslations('admin.calendar');
  const dfLocale = dateFnsLocale(useLocale() as AppLocale);
  const today = isSameDay(day, nowInCostaRica());
  return (
    <div className="sticky top-0 z-10 bg-white text-center py-2 border-b border-ink/10">
      <p className="font-body text-xs text-ink/70 capitalize">
        {format(day, t('dayFormats.weekday'), { locale: dfLocale })}
      </p>
      {today ? (
        <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-burgundy text-cream font-body text-sm font-medium">
          {format(day, t('dayFormats.dayOfMonth'), { locale: dfLocale })}
        </span>
      ) : (
        <p className="font-body text-lg font-light text-ink leading-8 mt-0.5">
          {format(day, t('dayFormats.dayOfMonth'), { locale: dfLocale })}
        </p>
      )}
    </div>
  );
}

function CalendarClassCard({
  clase,
  column,
  columns,
  onClick,
}: {
  clase: SerializedClass;
  column: number;
  columns: number;
  onClick: () => void;
}) {
  const top = classTopPx(clase.startsAt);
  const height = Math.max(((clase.durationMinutes ?? 60) / 60) * HOUR_PX, 48);
  const filled = clase.capacity - clase.spotsRemaining;
  const cat = categoryFor(clase.name);
  const time = format(inCostaRica(clase.startsAt), 'HH:mm');
  // The tint sits on white, so the hour lines don't show through the card.
  const tint = (alpha: string) => `linear-gradient(${cat.stripe}${alpha}, ${cat.stripe}${alpha})`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // don't trigger the column's "add class" handler
        onClick();
      }}
      title={`${clase.name} · ${time} · ${filled}/${clase.capacity}`}
      className="absolute flex flex-col justify-start px-1.5 py-1 xl:px-2 xl:py-1.5 text-left overflow-hidden border-l-[3px] transition-colors duration-200 cursor-pointer"
      style={{
        top,
        height,
        left: `${(column / columns) * 100}%`,
        width: `${100 / columns}%`,
        borderLeftColor: cat.stripe,
        backgroundColor: '#ffffff',
        backgroundImage: tint('1F'), // 0x1F ≈ 12%
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundImage = tint('33'); // 0x33 = 20%
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundImage = tint('1F');
      }}
    >
      {/* A short card has room for one line of name; anything more would be
          cut through the middle of a word. */}
      <span
        className={`block w-full font-body text-xs xl:text-sm font-medium text-ink leading-tight ${
          height >= 64 ? 'line-clamp-2' : 'truncate'
        }`}
      >
        {clase.name}
      </span>
      <span className="block w-full font-body text-xs text-ink/70 mt-0.5 truncate">
        {time}
        {height >= 64 && ` · ${filled}/${clase.capacity}`}
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Mobile — day selector + vertical list
// ═══════════════════════════════════════════════════════════════════════════
function MobileDaySelector({
  days,
  selected,
  onSelect,
}: {
  days: Date[];
  selected: number;
  onSelect: (idx: number) => void;
}) {
  const t = useTranslations('admin.calendar');
  const dfLocale = dateFnsLocale(useLocale() as AppLocale);
  return (
    <div className="mb-5 grid grid-cols-7 gap-1">
      {days.map((day, i) => {
        const today = isSameDay(day, nowInCostaRica());
        const active = i === selected;
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelect(i)}
            aria-pressed={active}
            className={`
              flex flex-col items-center py-2 border transition-colors duration-200 cursor-pointer
              ${
                active
                  ? 'border-burgundy bg-burgundy text-cream'
                  : 'border-ink/15 bg-white text-ink'
              }
            `}
          >
            <span
              className={`font-body text-[11px] capitalize ${
                active ? 'text-cream/90' : 'text-ink/70'
              }`}
            >
              {format(day, t('dayFormats.weekday'), { locale: dfLocale })}
            </span>
            <span
              className={`font-body text-base leading-none mt-1 ${
                today && !active ? 'text-burgundy font-medium' : ''
              }`}
            >
              {format(day, t('dayFormats.dayOfMonth'), { locale: dfLocale })}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MobileDayList({
  classes,
  onSelect,
  onCreate,
}: {
  classes: SerializedClass[];
  onSelect: (c: SerializedClass) => void;
  onCreate: () => void;
}) {
  const t = useTranslations('admin.calendar');
  const addButton = (
    <button
      type="button"
      onClick={onCreate}
      className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-ink/25 font-body text-sm text-ink/60 hover:border-ink/50 hover:text-ink transition-colors duration-200 cursor-pointer"
    >
      <Plus width={16} height={16} strokeWidth={1.5} />
      {t('mobile.addClass')}
    </button>
  );

  if (classes.length === 0) {
    return (
      <div className="space-y-4">
        <p className="font-body text-sm text-ink/70 py-8 text-center">
          {t('mobile.noClassesThisDay')}
        </p>
        {addButton}
      </div>
    );
  }

  // Sort by time ascending for the mobile day view.
  const sorted = [...classes].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return (
    <div className="space-y-3">
      {sorted.map((clase) => {
        const cat = categoryFor(clase.name);
        const filled = clase.capacity - clase.spotsRemaining;
        return (
          <button
            key={clase.id}
            type="button"
            onClick={() => onSelect(clase)}
            className="w-full text-left p-4 border-l-[3px] flex items-center gap-4 transition-colors duration-200 cursor-pointer"
            style={{ borderLeftColor: cat.stripe, backgroundColor: `${cat.stripe}14` }}
          >
            <div className="font-body text-sm text-ink font-medium w-12">
              {format(inCostaRica(clase.startsAt), 'HH:mm')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-sm font-medium text-ink truncate">
                {clase.name}
              </p>
              <p className="font-body text-xs text-ink/60 mt-0.5">
                {filled}/{clase.capacity} · {t(`category.${cat.label}`)}
              </p>
            </div>
          </button>
        );
      })}
      <div className="pt-1">{addButton}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Drawer content
// ═══════════════════════════════════════════════════════════════════════════
function DrawerContent({
  clase,
  bookings,
  occupied,
  occupancyPct,
  onClose,
  onEdit,
  onDelete,
  onAddParticipant,
}: {
  clase: SerializedClass;
  bookings: SerializedBooking[];
  occupied: number;
  occupancyPct: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddParticipant: () => void;
}) {
  const t = useTranslations('admin.calendar');
  const tc = useTranslations('admin.common');
  const dfLocale = dateFnsLocale(useLocale() as AppLocale);
  const cat = categoryFor(clase.name);
  const remaining = clase.spotsRemaining;
  const remainingLabel = t('drawer.remaining', { count: remaining });

  return (
    <div className="flex flex-col h-full">
      {/* Top bar — category dot + close */}
      <div className="sticky top-0 z-10 bg-white flex justify-between items-center px-5 sm:px-6 py-3 border-b border-ink/10">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: cat.stripe }}
          />
          <span className="font-body text-sm text-ink/70 truncate">
            {t(`category.${cat.label}`)}
          </span>
        </div>
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
        {/* Class title */}
        <h2 className="font-body text-xl font-medium text-ink leading-tight">
          {clase.name}
        </h2>

        {/* Occupancy */}
        <div className="mt-6">
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-ink/70">
              {t('drawer.occupancy')}
            </span>
            <span className="font-body text-sm text-ink">
              {t('drawer.bookingsCount', { occupied, capacity: clase.capacity })}
            </span>
          </div>
          <div className="h-1 bg-ink/10 mt-2 relative overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full transition-all duration-500"
              style={{ width: `${occupancyPct}%`, background: cat.stripe }}
            />
          </div>
          <p className="font-body text-xs text-ink/70 mt-2">{remainingLabel}</p>
        </div>

        {/* Metadata */}
        <div className="mt-8">
          <MetaRow
            icon={<CalendarIcon width={16} height={16} strokeWidth={1.5} />}
            label={tc('labels.dateTime')}
            value={t('drawer.dateTimeValue', {
              date: capitalize(format(inCostaRica(clase.startsAt), t('drawer.dateTimePattern'), { locale: dfLocale })),
            })}
          />
          <MetaRow
            icon={<Clock width={16} height={16} strokeWidth={1.5} />}
            label={tc('labels.duration')}
            value={tc('units.minutes', { count: clase.durationMinutes })}
          />
          <MetaRow
            icon={<MapPin width={16} height={16} strokeWidth={1.5} />}
            label={tc('labels.location')}
            value={clase.location.toLowerCase() === 'open-air shala' ? t('drawer.openAirShala') : clase.location}
          />
          <MetaRow
            icon={<DollarSign width={16} height={16} strokeWidth={1.5} />}
            label={tc('labels.price')}
            value={clase.priceUsd === 0 ? tc('status.free') : tc('units.usd', { amount: clase.priceUsd })}
          />
          {clase.instructor && (
            <MetaRow
              icon={<User width={16} height={16} strokeWidth={1.5} />}
              label={tc('labels.instructor')}
              value={clase.instructor}
              isLast
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-8">
          <Button
            variant="secondary"
            icon={<Pencil width={16} height={16} strokeWidth={1.5} />}
            onClick={onEdit}
          >
            {tc('actions.edit')}
          </Button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-2 px-3 py-2 font-body text-sm text-burgundy hover:opacity-70 transition-opacity duration-200 cursor-pointer"
          >
            <Trash2 width={16} height={16} strokeWidth={1.5} />
            <span>{tc('actions.delete')}</span>
          </button>
        </div>

        {/* Bookings */}
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-body text-base font-medium text-ink">
              {t('drawer.bookingsHeading', { count: bookings.length })}
            </h3>
            <Button
              variant="primary"
              icon={<UserPlus width={16} height={16} strokeWidth={1.5} />}
              onClick={onAddParticipant}
              disabled={remaining === 0}
            >
              {t('drawer.addParticipant')}
            </Button>
          </div>
          {remaining === 0 && (
            <p className="font-body text-xs text-ink/70 mt-2">
              {t('drawer.classFull')}
            </p>
          )}
          {bookings.length === 0 ? (
            <p className="font-body text-sm text-ink/70 py-8 text-center">
              {t('drawer.noBookings')}
            </p>
          ) : (
            <ul className="mt-4">
              {bookings.map((b, i) => {
                const badge = paymentBadgeFor(b.paymentStatus);
                return (
                  <li
                    key={b.id}
                    className={`flex items-start justify-between gap-3 py-3 ${
                      i === bookings.length - 1 ? '' : 'border-b border-ink/10'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm text-ink truncate">
                        {b.firstName} {b.lastName}
                      </p>
                      <p className="font-body text-xs text-ink/70 mt-0.5 truncate">
                        {b.email}
                      </p>
                    </div>
                    <Badge variant={badge.variant}>
                      {badge.labelKey ? tc(`status.${badge.labelKey}`) : b.paymentStatus}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
  isLast = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 py-4 ${
        isLast ? '' : 'border-b border-ink/10'
      }`}
    >
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
