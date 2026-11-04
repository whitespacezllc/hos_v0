'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Search,
  BookOpen,
  Users,
} from 'lucide-react';
import type { ClassTemplate, Instructor } from '@/types';
import ClassModal, { type TemplatePayload } from '@/components/admin/ClassModal';
import InstructorModal from '@/components/admin/InstructorModal';
import { PageContainer } from '@/components/admin/PageContainer';
import { PageHeader } from '@/components/admin/PageHeader';
import { RowIconButton } from '@/components/admin/RowIconButton';
import { Button } from '@/components/admin/Button';
import { Badge } from '@/components/admin/Badge';
import { EmptyState } from '@/components/admin/EmptyState';
import { DeleteConfirmation } from '@/components/admin/DeleteConfirmation';
import { NativeSelect } from '@/components/admin/NativeSelect';
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplateActive,
  upcomingBookingsForTemplate,
} from '@/app/actions/classes';
import type { ActionResult } from '@/lib/schedule/sessions';

// ─── Category palette — mirrors /yoga and /admin/calendario ────────────────
// The label of each category lives in the catalogue (admin.schedule.categories).
type CategoryKey = 'flowVinyasa' | 'yinRestorative' | 'hathaGentle' | 'ashtangaIntense' | 'meditation';
const CATEGORY_STYLES: Record<string, { stripe: string; label: CategoryKey }> = {
  'flow-vinyasa':     { stripe: '#8B6F47', label: 'flowVinyasa' },
  'yin-restorative':  { stripe: '#6B7355', label: 'yinRestorative' },
  'hatha-gentle':     { stripe: '#A6896D', label: 'hathaGentle' },
  'ashtanga-intense': { stripe: '#5A3E2B', label: 'ashtangaIntense' },
  'meditation':       { stripe: '#7A6B5D', label: 'meditation' },
};

function getCategoryKey(name: string): string {
  if (['Sunrise Vinyasa', 'Power Flow', 'Breath & Movement', 'Vinyasa Flow', 'Vinyasa Krama', 'Detox Yoga'].includes(name)) return 'flow-vinyasa';
  if (['Yin Yoga', 'Yin & Restore', 'Restorative Yoga', 'Deep Stretch & Breath'].includes(name)) return 'yin-restorative';
  if (['Gentle Flow', 'Hatha Foundations'].includes(name)) return 'hatha-gentle';
  if (['Ashtanga Primary'].includes(name)) return 'ashtanga-intense';
  if (['Pranayama & Meditación', 'Meditation', 'Tantra Vinyasa'].includes(name)) return 'meditation';
  return 'flow-vinyasa';
}

// day_of_week (0=Sun … 6=Sat) → catalogue key of the weekday (admin.schedule.days)
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

// ═══════════════════════════════════════════════════════════════════════════
export default function ClasesClient({
  initialTemplates,
  instructors,
  standardPriceUsd,
}: {
  initialTemplates: ClassTemplate[];
  instructors: Instructor[];
  /** The standard drop-in price, a new class's starting point. */
  standardPriceUsd: number;
}) {
  const router = useRouter();
  const t = useTranslations('admin.schedule');
  const tc = useTranslations('admin.common');
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClassTemplate | undefined>();
  const [deletingTemplate, setDeletingTemplate] = useState<ClassTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [instructorModalOpen, setInstructorModalOpen] = useState(false);
  // What the last save or delete left to say: sessions kept aside for their
  // bookings, or that it failed.
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Upcoming sessions with bookings of the class about to be deleted.
  const [deleteSummary, setDeleteSummary] = useState<{ sessions: number; persons: number } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const templates = initialTemplates;

  function instructorName(tpl: ClassTemplate): string {
    return (
      tpl.instructors?.name ??
      instructors.find((i) => i.id === tpl.instructor_id)?.name ??
      ''
    );
  }

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('filters.allStatuses') },
      { value: 'active', label: tc('status.active') },
      { value: 'inactive', label: tc('status.inactive') },
    ],
    [t, tc],
  );

  const categoryOptions = useMemo(() => {
    const present = new Set(templates.map((tpl) => getCategoryKey(tpl.name)));
    return [
      { value: 'all', label: t('filters.allCategories') },
      ...Object.entries(CATEGORY_STYLES)
        .filter(([k]) => present.has(k))
        .map(([key, val]) => ({ value: key, label: t(`categories.${val.label}`) })),
    ];
  }, [templates, t]);

  const filtered = useMemo(() => {
    return templates.filter((tpl) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !tpl.name.toLowerCase().includes(q) &&
          !tpl.slug.toLowerCase().includes(q) &&
          !instructorName(tpl).toLowerCase().includes(q)
        )
          return false;
      }
      if (statusFilter === 'active' && !tpl.is_active) return false;
      if (statusFilter === 'inactive' && tpl.is_active) return false;
      if (categoryFilter !== 'all' && getCategoryKey(tpl.name) !== categoryFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, search, statusFilter, categoryFilter]);

  const filtersActive = search !== '' || statusFilter !== 'all' || categoryFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
  }

  function failureText(error: Extract<ActionResult, { ok: false }>['error']): string {
    if (error === 'not_admin') return tc('feedback.signedInRequired');
    return error === 'delete_failed' ? tc('feedback.couldNotDelete') : tc('feedback.couldNotSave');
  }

  function handleToggleActive(id: string) {
    startTransition(async () => {
      try {
        const res = await toggleTemplateActive(id);
        if (!res.ok) {
          setNotice({ tone: 'error', text: failureText(res.error) });
          return;
        }
        setNotice(null);
        router.refresh();
      } catch {
        setNotice({ tone: 'error', text: tc('feedback.couldNotSave') });
      }
    });
  }

  function openDelete(tpl: ClassTemplate) {
    setDeleteError(null);
    setDeleteSummary(null);
    setDeletingTemplate(tpl);
    // Who is booked into its upcoming sessions, for the confirmation to say.
    upcomingBookingsForTemplate(tpl.id)
      .then((res) => {
        if (res.ok) setDeleteSummary({ sessions: res.sessions, persons: res.persons });
      })
      .catch(() => {});
  }

  async function handleConfirmDelete() {
    if (!deletingTemplate) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteTemplate(deletingTemplate.id);
      if (!res.ok) {
        setDeleteError(failureText(res.error));
        return;
      }
      setDeletingTemplate(null);
      setNotice(
        res.emailsFailed > 0
          ? { tone: 'error', text: t('deletedEmailsFailed', { count: res.emailsFailed }) }
          : res.cancelled > 0
          ? { tone: 'info', text: t('deletedNotified', { count: res.cancelled }) }
          : null,
      );
      router.refresh();
    } catch {
      setDeleteError(tc('feedback.couldNotDelete'));
    } finally {
      setIsDeleting(false);
    }
  }

  function handleSaveTemplate(data: TemplatePayload) {
    setSaveError(null);
    startTransition(async () => {
      try {
        const res: ActionResult<{ keptWithBookings?: number }> = editingTemplate
          ? await updateTemplate(editingTemplate.id, data)
          : await createTemplate(data);
        if (!res.ok) {
          setSaveError(failureText(res.error));
          return;
        }
        const kept = res.keptWithBookings ?? 0;
        setNotice(kept > 0 ? { tone: 'info', text: t('keptWithBookings', { count: kept }) } : null);
        setModalOpen(false);
        router.refresh();
      } catch {
        setSaveError(tc('feedback.couldNotSave'));
      }
    });
  }

  return (
    <PageContainer>
      <PageHeader
        heading={t('heading')}
        description={t('subtitle', { count: templates.length })}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Users width={16} height={16} strokeWidth={1.5} />}
              onClick={() => setInstructorModalOpen(true)}
            >
              {t('manageInstructors')}
            </Button>
            <Button
              variant="primary"
              icon={<Plus width={16} height={16} strokeWidth={1.5} />}
              onClick={() => {
                setEditingTemplate(undefined);
                setSaveError(null);
                setModalOpen(true);
              }}
            >
              {t('newClass')}
            </Button>
          </>
        }
      />

      {notice && (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mb-6 font-body text-sm px-4 py-4 border ${
            notice.tone === 'error'
              ? 'text-burgundy border-burgundy/30 bg-burgundy/5'
              : 'text-ink/80 border-ink/20 bg-neutral-50'
          }`}
        >
          {notice.text}
        </p>
      )}

      {templates.length === 0 ? (
        <EmptyState
          icon={<BookOpen strokeWidth={1} />}
          heading={t('empty.heading')}
          description={t('empty.description')}
          action={
            <Button
              variant="primary"
              icon={<Plus width={16} height={16} strokeWidth={1.5} />}
              onClick={() => {
                setEditingTemplate(undefined);
                setSaveError(null);
                setModalOpen(true);
              }}
            >
              {t('newClass')}
            </Button>
          }
        />
      ) : (
        <>
          {/* ─── Filters bar ──────────────────────────────────────────── */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-center md:gap-4">
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
              aria-label={t('filters.byStatus')}
              className="w-full md:w-auto"
            />
            <NativeSelect
              filter
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={categoryOptions}
              aria-label={t('filters.byCategory')}
              className="w-full md:w-auto"
            />
          </div>

          {/* ─── Table ────────────────────────────────────────────────── */}
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
            <TemplatesTable
              templates={filtered}
              instructorName={instructorName}
              isPending={isPending}
              onToggleActive={handleToggleActive}
              onEdit={(tpl) => {
                setEditingTemplate(tpl);
                setSaveError(null);
                setModalOpen(true);
              }}
              onDelete={openDelete}
            />
          )}
        </>
      )}

      <ClassModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSaveTemplate}
        template={editingTemplate}
        instructors={instructors}
        loading={isPending}
        error={saveError}
        standardPriceUsd={standardPriceUsd}
      />

      <InstructorModal
        open={instructorModalOpen}
        onOpenChange={setInstructorModalOpen}
        instructors={instructors}
        onChanged={() => router.refresh()}
      />

      <DeleteConfirmation
        isOpen={!!deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        onConfirm={handleConfirmDelete}
        title={t('delete.title')}
        description={
          deleteSummary && deleteSummary.sessions > 0
            ? `${t('delete.description')} ${t('delete.withBookings', deleteSummary)}`
            : t('delete.description')
        }
        confirmLabel={t('delete.confirm')}
        cancelLabel={tc('actions.cancel')}
        loading={isDeleting}
        error={deleteError}
      />
    </PageContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Table
// ═══════════════════════════════════════════════════════════════════════════
function TemplatesTable({
  templates,
  instructorName,
  isPending,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  templates: ClassTemplate[];
  instructorName: (t: ClassTemplate) => string;
  isPending: boolean;
  onToggleActive: (id: string) => void;
  onEdit: (t: ClassTemplate) => void;
  onDelete: (t: ClassTemplate) => void;
}) {
  const t = useTranslations('admin.schedule');
  const tc = useTranslations('admin.common');
  // What fits decides what shows: instructor and capacity join from `xl` and
  // the slug from `2xl`. The price is always there; it's what gets looked up.
  const headers = [
    { label: tc('labels.class'), className: '' },
    { label: t('table.slug'), className: 'hidden 2xl:table-cell' },
    { label: tc('labels.instructor'), className: 'hidden xl:table-cell' },
    { label: t('table.schedule'), className: '' },
    { label: tc('labels.capacity'), className: 'hidden xl:table-cell' },
    { label: tc('labels.price'), className: '' },
    { label: tc('labels.status'), className: '' },
    { label: '', className: '' },
  ];

  const price = (tpl: ClassTemplate) =>
    tpl.price_dropin_usd == null
      ? '—'
      : tpl.price_dropin_usd === 0
      ? tc('status.free')
      : tc('units.priceUsd', { amount: tpl.price_dropin_usd });

  const rowActions = (tpl: ClassTemplate) => (
    <>
      <RowIconButton
        ariaLabel={tpl.is_active ? t('actions.deactivate') : t('actions.activate')}
        onClick={() => onToggleActive(tpl.id)}
        disabled={isPending}
      >
        {tpl.is_active ? (
          <Eye width={16} height={16} strokeWidth={1.5} />
        ) : (
          <EyeOff width={16} height={16} strokeWidth={1.5} />
        )}
      </RowIconButton>
      <RowIconButton ariaLabel={t('actions.edit')} onClick={() => onEdit(tpl)}>
        <Pencil width={16} height={16} strokeWidth={1.5} />
      </RowIconButton>
      <RowIconButton ariaLabel={t('actions.delete')} onClick={() => onDelete(tpl)} hoverDestructive>
        <Trash2 width={16} height={16} strokeWidth={1.5} />
      </RowIconButton>
    </>
  );

  return (
    <>
      {/* Phone — one card per class */}
      <ul className="md:hidden space-y-3">
        {templates.map((tpl) => {
          const cat = CATEGORY_STYLES[getCategoryKey(tpl.name)];
          const name = instructorName(tpl);
          const time = (tpl.time_start ?? '').slice(0, 5);
          return (
            <li key={tpl.id} className="bg-white border border-ink/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: cat.stripe }}
                  />
                  <div className="min-w-0">
                    <p className="font-body text-sm font-medium text-ink truncate">{tpl.name}</p>
                    <p className="font-body text-xs text-ink/70 mt-0.5 truncate">
                      {name || t('unassigned')}
                    </p>
                  </div>
                </div>
                <Badge variant={tpl.is_active ? 'active' : 'neutral'} className="flex-shrink-0">
                  {tpl.is_active ? tc('status.active') : tc('status.inactive')}
                </Badge>
              </div>
              <p className="font-body text-sm text-ink mt-3">
                {t('table.every', { day: t(`days.${DAY_KEYS[tpl.day_of_week]}`), time })}
              </p>
              <p className="font-body text-xs text-ink/70 mt-0.5">
                {tc('units.min', { count: tpl.duration_minutes })} · {tpl.capacity} {t('table.seats')}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-body text-sm font-medium text-ink">{price(tpl)}</span>
                <div className="flex items-center -mr-2">{rowActions(tpl)}</div>
              </div>
            </li>
          );
        })}
      </ul>

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
              {templates.map((tpl) => {
                const cat = CATEGORY_STYLES[getCategoryKey(tpl.name)];
                const name = instructorName(tpl);
                const time = (tpl.time_start ?? '').slice(0, 5);

                return (
                  <tr
                    key={tpl.id}
                    className="border-b border-ink/[0.08] last:border-0 hover:bg-neutral-50 transition-colors duration-200"
                  >
                    <td className="px-3 py-3 max-w-[16rem]">
                      <div className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                          style={{ background: cat.stripe }}
                        />
                        <div className="min-w-0">
                          <p className="font-body text-sm font-medium text-ink truncate">
                            {tpl.name}
                          </p>
                          <p className="font-body text-xs text-ink/70 mt-0.5 truncate">
                            <span className="xl:hidden">{name || t('unassigned')}</span>
                            <span className="hidden xl:inline">{tpl.location}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden 2xl:table-cell">
                      <span className="font-mono text-xs text-ink/80 bg-neutral-50 px-2 py-0.5">
                        {tpl.slug}
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden xl:table-cell max-w-[12rem]">
                      {name ? (
                        <span className="block font-body text-sm text-ink/80 truncate">{name}</span>
                      ) : (
                        <span className="font-body text-sm text-ink/60">{t('unassigned')}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-body text-sm text-ink whitespace-nowrap">
                        {t('table.every', { day: t(`days.${DAY_KEYS[tpl.day_of_week]}`), time })}
                      </p>
                      <p className="font-body text-xs text-ink/70 mt-0.5 whitespace-nowrap">
                        {tc('units.min', { count: tpl.duration_minutes })}
                        <span className="xl:hidden"> · {tpl.capacity} {t('table.seats')}</span>
                      </p>
                    </td>
                    <td className="px-3 py-3 hidden xl:table-cell">
                      <span className="font-body text-sm font-medium text-ink whitespace-nowrap">
                        {tpl.capacity}
                        <span className="text-ink/70 font-normal"> {t('table.seats')}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-body text-sm font-medium text-ink whitespace-nowrap">{price(tpl)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={tpl.is_active ? 'active' : 'neutral'}>
                        {tpl.is_active ? tc('status.active') : tc('status.inactive')}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">{rowActions(tpl)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
