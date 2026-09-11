'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Palmtree, ExternalLink, CalendarDays } from 'lucide-react';
import type { RetreatListing } from '@/types';
import type { AppLocale } from '@/i18n/routing';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/admin/Card';
import { Button } from '@/components/admin/Button';
import { Badge } from '@/components/admin/Badge';
import { EmptyState } from '@/components/admin/EmptyState';
import { DeleteConfirmation } from '@/components/admin/DeleteConfirmation';
import { Modal } from '@/components/admin/Modal';
import { Input } from '@/components/admin/Input';
import { Textarea } from '@/components/admin/Textarea';
import { Toggle } from '@/components/admin/Toggle';
import { Field } from '@/components/admin/Field';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { uploadRetreatImage } from '@/app/actions/uploads';
import {
  createRetreatListing,
  deleteRetreatListing,
  setRetreatListingPublished,
  updateRetreatListing,
} from '@/app/actions/retreatListings';
import {
  DEFAULT_RETREAT_IMAGE,
  RETREAT_DESCRIPTION_MAX,
  RETREAT_IMAGE,
  RETREAT_INSTRUCTORS_MAX,
  RETREAT_LABEL_MAX,
  RETREAT_TITLE_MAX,
  buildRetreatListingSchema,
  formatRetreatDates,
  isSitePath,
  retreatListingMessageKey,
  splitRetreatListings,
  type RetreatListingFormValues,
  type RetreatListingMessages,
} from '@/lib/retreat-listings';

// ─── Retreats ────────────────────────────────────────────────────────────────
// The panel behind /upcoming-retreats. Two lists — what is coming, what has
// been — drawn from one table by today's date, and one form for a retreat:
// its photograph, what kind of thing it is, its name, who runs it, its days,
// a few lines about it and the link "More info" opens. The Spanish version
// of the label and the description is there for the admin who wants it and
// out of the way for the one who doesn't.

const DEFAULTS: RetreatListingFormValues = {
  title: '',
  label: '',
  instructors: '',
  startsOn: '',
  endsOn: '',
  description: '',
  url: '',
  imageUrl: null,
  labelEs: '',
  descriptionEs: '',
  isPublished: true,
};

const ICON_BUTTON =
  'w-8 h-8 p-1.5 inline-flex items-center justify-center text-ink/60 hover:bg-neutral-50 transition-colors duration-200 cursor-pointer';

type RowError = { id: string; message: string } | null;

// ═══════════════════════════════════════════════════════════════════════════
export default function RetreatsClient({
  listings,
  loadFailed = false,
  today,
}: {
  listings: RetreatListing[];
  /** The read failed — say so, rather than show an empty list and invite a first retreat. */
  loadFailed?: boolean;
  today: string;
}) {
  const router = useRouter();
  const t = useTranslations('admin.retreats');
  const tc = useTranslations('admin.common');
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RetreatListing | undefined>();
  const [spanishOpen, setSpanishOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RetreatListing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // A failed toggle or delete is reported on the row it happened to.
  const [rowError, setRowError] = useState<RowError>(null);

  // The schema refuses in the reader's language; the server re-validates in
  // English and its message is matched back to the same key (describeError).
  const messages = useMemo<RetreatListingMessages>(
    () => ({
      titleRequired: t('validation.titleRequired'),
      titleTooLong: t('validation.titleTooLong', { max: RETREAT_TITLE_MAX }),
      labelRequired: t('validation.labelRequired'),
      labelTooLong: t('validation.labelTooLong', { max: RETREAT_LABEL_MAX }),
      instructorsRequired: t('validation.instructorsRequired'),
      instructorsTooLong: t('validation.instructorsTooLong', { max: RETREAT_INSTRUCTORS_MAX }),
      startsOnRequired: t('validation.startsOnRequired'),
      endsOnRequired: t('validation.endsOnRequired'),
      descriptionRequired: t('validation.descriptionRequired'),
      descriptionTooLong: t('validation.descriptionTooLong', { max: RETREAT_DESCRIPTION_MAX }),
      urlRequired: t('validation.urlRequired'),
      urlInvalid: t('validation.urlInvalid'),
      endsBeforeStarts: t('validation.endsBeforeStarts'),
    }),
    [t],
  );
  const schema = useMemo(() => buildRetreatListingSchema(messages), [messages]);

  // What a server action refused with, in the reader's words where the
  // words are known: the schema's own, the action's generic ones, or the
  // admin check's. A database message has no translation and is shown as
  // it came.
  function describeError(message: string): string {
    const key = retreatListingMessageKey(message);
    if (key) return messages[key];
    if (message === 'Please check the form.') return t('errors.checkForm');
    if (message === 'Something went wrong. Please try again.') return tc('feedback.somethingWentWrong');
    if (message === 'You need to be signed in as an admin.') return tc('feedback.signedInRequired');
    return message;
  }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<RetreatListingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  const imageUrl = watch('imageUrl') ?? null;
  const isPublished = watch('isPublished') ?? true;
  const startsOn = watch('startsOn') ?? '';
  const description = watch('description') ?? '';
  const descriptionEs = watch('descriptionEs') ?? '';

  const { upcoming, past } = splitRetreatListings(listings, today);

  function openCreate() {
    setEditing(undefined);
    setSubmitError(null);
    setSpanishOpen(false);
    reset(DEFAULTS);
    setModalOpen(true);
  }

  function openEdit(l: RetreatListing) {
    setEditing(l);
    setSubmitError(null);
    setSpanishOpen(Boolean(l.labelEs || l.descriptionEs));
    reset({
      title: l.title,
      label: l.label,
      instructors: l.instructors,
      startsOn: l.startsOn,
      endsOn: l.endsOn,
      description: l.description,
      url: l.url,
      imageUrl: l.imageUrl,
      labelEs: l.labelEs ?? '',
      descriptionEs: l.descriptionEs ?? '',
      isPublished: l.isPublished,
    });
    setModalOpen(true);
  }

  function onSubmit(values: RetreatListingFormValues) {
    setSubmitError(null);
    startTransition(async () => {
      const res = editing
        ? await updateRetreatListing(editing.id, values)
        : await createRetreatListing(values);
      if (!res.ok) {
        setSubmitError(describeError(res.error));
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handlePublish(l: RetreatListing, next: boolean) {
    setRowError(null);
    startTransition(async () => {
      const res = await setRetreatListingPublished(l.id, next);
      if (!res.ok) {
        setRowError({ id: l.id, message: describeError(res.error) });
        return;
      }
      router.refresh();
    });
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setIsDeleting(true);
    setRowError(null);
    try {
      const res = await deleteRetreatListing(target.id);
      // Either way the dialog closes: a failure is told on the row, where
      // the admin can see it, not behind a backdrop.
      setDeleting(null);
      if (!res.ok) {
        setRowError({ id: target.id, message: describeError(res.error) });
        return;
      }
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  const newButton = (
    <Button
      variant="primary"
      icon={<Plus width={16} height={16} strokeWidth={1.5} />}
      onClick={openCreate}
    >
      {t('actions.newRetreat')}
    </Button>
  );

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-5xl mx-auto">
      <PageHeader
        heading={t('page.heading')}
        description={t('page.description')}
        actions={newButton}
      />

      {loadFailed ? (
        <p
          role="alert"
          className="font-body text-sm text-burgundy border border-burgundy/30 bg-burgundy/5 px-4 py-4"
        >
          {t('loadFailed')}
        </p>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={<Palmtree strokeWidth={1} />}
          heading={t('empty.heading')}
          description={t('empty.description')}
          action={newButton}
        />
      ) : (
        <div className="space-y-12">
          <ListingSection
            title={t('upcoming.title')}
            ariaLabel={t('upcoming.aria')}
            hint={t('upcoming.hint')}
            emptyText={t('upcoming.empty')}
            items={upcoming}
            today={today}
            busy={isPending}
            rowError={rowError}
            onEdit={openEdit}
            onDelete={setDeleting}
            onPublish={handlePublish}
          />
          <ListingSection
            title={t('past.title')}
            ariaLabel={t('past.aria')}
            hint={t('past.hint')}
            emptyText={t('past.empty')}
            items={past}
            today={today}
            busy={isPending}
            rowError={rowError}
            onEdit={openEdit}
            onDelete={setDeleting}
            onPublish={handlePublish}
            muted
          />
        </div>
      )}

      {/* ─── Form ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('form.editTitle') : t('form.newTitle')}
        subtitle={editing ? undefined : t('form.newSubtitle')}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={isPending}>
              {tc('actions.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isPending}>
              {editing ? t('actions.saveChanges') : t('actions.addRetreat')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {/* The photograph sits beside the first two fields at the size of a
              thumbnail, so the form opens on the whole of what a card is
              rather than on one large empty frame with the fields below the
              fold. */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_minmax(0,1fr)] gap-6 items-start">
            <ImageUpload
              value={imageUrl}
              onChange={(url) => setValue('imageUrl', url, { shouldDirty: true })}
              upload={uploadRetreatImage}
              aspect={RETREAT_IMAGE.ratio}
              label={t('form.photo.label')}
              helper={t('form.photo.helper', { width: RETREAT_IMAGE.width, height: RETREAT_IMAGE.height })}
              hint={t('form.photo.hint', { width: RETREAT_IMAGE.width, height: RETREAT_IMAGE.height })}
              previewAlt={t('form.photo.previewAlt')}
              inputId="retreat-photo"
            />
            <div className="space-y-6">
              <Input
                id="retreat-label"
                label={t('form.label.label')}
                placeholder={t('form.label.placeholder')}
                helper={t('form.label.helper')}
                error={errors.label?.message}
                {...register('label')}
              />
              <Input
                id="retreat-title"
                label={t('form.title.label')}
                placeholder={t('form.title.placeholder')}
                error={errors.title?.message}
                {...register('title')}
              />
            </div>
          </div>

          <Input
            id="retreat-instructors"
            label={t('form.instructors.label')}
            placeholder={t('form.instructors.placeholder')}
            helper={t('form.instructors.helper')}
            error={errors.instructors?.message}
            {...register('instructors')}
          />

          {/* The last day follows the first: it can't be picked before it,
              and when it is empty or earlier it moves along with it, so a
              one-day retreat is one pick and a week is two. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Input
              id="retreat-starts-on"
              type="date"
              label={t('form.startsOn.label')}
              error={errors.startsOn?.message}
              {...register('startsOn', {
                onChange: (e) => {
                  const first = (e.target as HTMLInputElement).value;
                  const last = getValues('endsOn');
                  if (first && (!last || last < first)) {
                    setValue('endsOn', first, { shouldDirty: true, shouldValidate: !!last });
                  }
                },
              })}
            />
            <Input
              id="retreat-ends-on"
              type="date"
              label={t('form.endsOn.label')}
              min={startsOn || undefined}
              error={errors.endsOn?.message}
              {...register('endsOn')}
            />
          </div>

          <Textarea
            id="retreat-description"
            label={t('form.description.label')}
            placeholder={t('form.description.placeholder')}
            rows={3}
            maxLength={RETREAT_DESCRIPTION_MAX}
            helper={t('form.description.helper', { count: description.length, max: RETREAT_DESCRIPTION_MAX })}
            error={errors.description?.message}
            {...register('description')}
          />

          <Input
            id="retreat-url"
            type="url"
            inputMode="url"
            label={t('form.url.label')}
            placeholder={t('form.url.placeholder')}
            helper={t('form.url.helper')}
            error={errors.url?.message}
            {...register('url')}
          />

          <Field label={t('form.published.label')} helper={t('form.published.helper')}>
            <div className="flex items-center justify-between mt-2">
              <span className="font-body text-sm text-ink">{isPublished ? t('form.published.shown') : t('form.published.hidden')}</span>
              <Toggle
                checked={isPublished}
                onChange={(v) => setValue('isPublished', v, { shouldDirty: true })}
                ariaLabel={t('form.published.toggleAria')}
              />
            </div>
          </Field>

          {/* Spanish is optional: the site shows the English wherever these are empty. */}
          <div className="border-t border-ink/10 pt-5">
            <button
              type="button"
              onClick={() => setSpanishOpen((o) => !o)}
              aria-expanded={spanishOpen}
              aria-controls="retreat-spanish"
              className="font-body text-[10px] tracking-[0.3em] uppercase text-ink/60 hover:text-ink transition-colors duration-200 cursor-pointer"
            >
              {spanishOpen ? t('form.spanish.close') : t('form.spanish.open')}
            </button>
            {spanishOpen && (
              <div id="retreat-spanish" className="space-y-6 mt-5">
                <p className="font-body text-xs text-ink/50">
                  {t('form.spanish.note')}
                </p>
                <Input
                  id="retreat-label-es"
                  label={t('form.labelEs.label')}
                  placeholder={t('form.labelEs.placeholder')}
                  error={errors.labelEs?.message}
                  {...register('labelEs')}
                />
                <Textarea
                  id="retreat-description-es"
                  label={t('form.descriptionEs.label')}
                  rows={3}
                  maxLength={RETREAT_DESCRIPTION_MAX}
                  helper={t('form.descriptionEs.helper', { count: descriptionEs.length, max: RETREAT_DESCRIPTION_MAX })}
                  error={errors.descriptionEs?.message}
                  {...register('descriptionEs')}
                />
              </div>
            )}
          </div>

          {submitError && (
            <p role="alert" className="font-body text-sm text-burgundy">
              {submitError}
            </p>
          )}
        </form>
      </Modal>

      <DeleteConfirmation
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        title={t('delete.title')}
        description={deleting ? t('delete.description', { title: deleting.title }) : ''}
        confirmLabel={t('actions.deleteRetreat')}
        cancelLabel={tc('actions.cancel')}
        loading={isDeleting}
      />
    </div>
  );
}

// ─── One list: upcoming or past ─────────────────────────────────────────────
function ListingSection({
  title,
  ariaLabel,
  hint,
  emptyText,
  items,
  today,
  busy,
  rowError,
  muted = false,
  onEdit,
  onDelete,
  onPublish,
}: {
  title: string;
  /** The section's name for assistive tech — "Upcoming retreats", not the bare "Upcoming". */
  ariaLabel: string;
  hint: string;
  emptyText: string;
  items: RetreatListing[];
  today: string;
  busy: boolean;
  rowError: RowError;
  muted?: boolean;
  onEdit: (l: RetreatListing) => void;
  onDelete: (l: RetreatListing) => void;
  onPublish: (l: RetreatListing, next: boolean) => void;
}) {
  return (
    <section aria-label={ariaLabel}>
      <header className="mb-4">
        <div className="flex items-baseline gap-3">
          <h2 className="font-body text-base font-medium text-ink">{title}</h2>
          <span className="font-body text-xs text-ink/50">{items.length}</span>
        </div>
        <p className="font-body text-xs text-ink/50 mt-1">{hint}</p>
      </header>

      {items.length === 0 ? (
        <p className="font-body text-sm text-ink/50 border border-dashed border-ink/15 px-4 py-5">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((l) => (
            <ListingRow
              key={l.id}
              listing={l}
              today={today}
              busy={busy}
              muted={muted}
              error={rowError?.id === l.id ? rowError.message : null}
              onEdit={() => onEdit(l)}
              onDelete={() => onDelete(l)}
              onPublish={(next) => onPublish(l, next)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ListingRow({
  listing: l,
  today,
  busy,
  muted,
  error,
  onEdit,
  onDelete,
  onPublish,
}: {
  listing: RetreatListing;
  today: string;
  busy: boolean;
  muted: boolean;
  error: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: (next: boolean) => void;
}) {
  const t = useTranslations('admin.retreats');
  const locale = useLocale() as AppLocale;
  const happeningNow = l.startsOn <= today && l.endsOn >= today;
  const external = !isSitePath(l.url);

  return (
    <Card padding="tight" className={!l.isPublished || muted ? 'opacity-75' : ''}>
      <div className="flex gap-4 items-start">
        <div className={`w-20 sm:w-24 flex-shrink-0 ${RETREAT_IMAGE.ratio} overflow-hidden bg-neutral-100`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={l.imageUrl || DEFAULT_RETREAT_IMAGE}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="neutral">{l.label}</Badge>
            {happeningNow && <Badge variant="active">{t('row.happeningNow')}</Badge>}
            {!l.isPublished && <Badge variant="inactive">{t('row.hidden')}</Badge>}
          </div>
          <h3 className="font-body text-base font-medium text-ink leading-tight mt-2">{l.title}</h3>
          <p className="font-body text-xs text-ink/60 mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span>{l.instructors}</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays width={12} height={12} strokeWidth={1.5} aria-hidden />
              {formatRetreatDates(l.startsOn, l.endsOn, locale)}
            </span>
          </p>
          <p className="font-body text-sm text-ink/70 leading-normal line-clamp-2 mt-2">
            {l.description}
          </p>
          <a
            href={l.url}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="font-body text-xs text-ink/50 hover:text-ink transition-colors duration-200 mt-2 inline-flex items-center gap-1 max-w-full"
          >
            <span className="truncate">{l.url}</span>
            {external && <ExternalLink width={11} height={11} strokeWidth={1.5} aria-hidden className="flex-shrink-0" />}
          </a>
          {error && (
            <p role="alert" className="font-body text-xs text-burgundy mt-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-ink/60 hidden sm:inline">
              {l.isPublished ? t('row.shown') : t('row.hidden')}
            </span>
            <Toggle
              checked={l.isPublished}
              onChange={onPublish}
              disabled={busy}
              ariaLabel={l.isPublished ? t('row.hideFromSite') : t('row.showOnSite')}
            />
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={onEdit} aria-label={t('row.edit', { title: l.title })} className={`${ICON_BUTTON} hover:text-ink`}>
              <Pencil width={16} height={16} strokeWidth={1.5} />
            </button>
            <button type="button" onClick={onDelete} aria-label={t('row.delete', { title: l.title })} className={`${ICON_BUTTON} hover:text-burgundy`}>
              <Trash2 width={16} height={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
