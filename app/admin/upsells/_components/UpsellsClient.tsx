'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import type { Upsell } from '@/types';
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
import {
  createUpsell,
  updateUpsell,
  toggleUpsellActive,
  deleteUpsell,
} from '@/app/actions/upsells';

// The schema is a factory so the validation copy follows the panel's language
// (same pattern as personalSchema in the public BookingFlow).
type UpsellSchemaMessages = {
  nameRequired: string;
  descriptionRequired: string;
  priceMin: string;
};

const upsellSchema = (msgs: UpsellSchemaMessages) =>
  z.object({
    name: z.string().min(1, msgs.nameRequired),
    description: z.string().min(1, msgs.descriptionRequired),
    priceUsd: z.coerce.number().min(0, msgs.priceMin),
    isActive: z.boolean(),
  });
type UpsellForm = z.infer<ReturnType<typeof upsellSchema>>;

const DEFAULTS: UpsellForm = {
  name: '',
  description: '',
  priceUsd: 0,
  isActive: true,
};

// ═══════════════════════════════════════════════════════════════════════════
export default function UpsellsClient({
  initialUpsells,
}: {
  initialUpsells: Upsell[];
}) {
  const router = useRouter();
  const t = useTranslations('admin.upsells');
  const tc = useTranslations('admin.common');
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Upsell | undefined>();
  const [deleting, setDeleting] = useState<Upsell | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const schema = useMemo(
    () =>
      upsellSchema({
        nameRequired: tc('validation.nameRequired'),
        descriptionRequired: tc('validation.descriptionRequired'),
        priceMin: tc('validation.priceMin'),
      }),
    [tc],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpsellForm>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  const isActive = watch('isActive');

  function openCreate() {
    setEditing(undefined);
    reset(DEFAULTS);
    setModalOpen(true);
  }

  function openEdit(u: Upsell) {
    setEditing(u);
    reset({
      name: u.name,
      description: u.description,
      priceUsd: u.priceUsd,
      isActive: u.isActive,
    });
    setModalOpen(true);
  }

  function onSubmit(values: UpsellForm) {
    startTransition(async () => {
      if (editing) {
        await updateUpsell(editing.id, values);
      } else {
        await createUpsell(values);
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleUpsellActive(id);
      router.refresh();
    });
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteUpsell(deleting.id);
      setDeleting(null);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-5xl mx-auto">
      <PageHeader
        heading={t('heading')}
        description={t('description')}
        actions={
          <Button
            variant="primary"
            icon={<Plus width={16} height={16} strokeWidth={1.5} />}
            onClick={openCreate}
          >
            {t('new')}
          </Button>
        }
      />

      {initialUpsells.length === 0 && (
        <EmptyState
          icon={<Tag strokeWidth={1} />}
          heading={t('empty.heading')}
          description={t('empty.description')}
          action={
            <Button
              variant="primary"
              icon={<Plus width={16} height={16} strokeWidth={1.5} />}
              onClick={openCreate}
            >
              {t('new')}
            </Button>
          }
        />
      )}

      {initialUpsells.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {initialUpsells.map((u) => (
            <Card key={u.id}>
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-body text-base font-medium text-ink leading-tight">
                      {u.name}
                    </h3>
                    <Badge variant={u.isActive ? 'active' : 'inactive'}>
                      {u.isActive ? tc('status.active') : tc('status.inactive')}
                    </Badge>
                  </div>
                </div>
                <span className="font-body text-base font-medium text-ink flex-shrink-0">
                  ${u.priceUsd}
                </span>
              </div>

              <p className="font-body text-sm text-ink/60 leading-normal mt-2 line-clamp-2">
                {u.description}
              </p>

              <div className="mt-6 pt-4 border-t border-ink/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Toggle
                    checked={u.isActive}
                    onChange={() => handleToggle(u.id)}
                    disabled={isPending}
                    ariaLabel={u.isActive ? t('toggle.hide') : t('toggle.show')}
                  />
                  <span className="font-body text-xs text-ink/60">
                    {u.isActive ? t('visible') : t('hidden')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    aria-label={t('edit')}
                    className="w-8 h-8 p-1.5 inline-flex items-center justify-center text-ink/60 hover:bg-neutral-50 hover:text-ink transition-colors duration-200 cursor-pointer"
                  >
                    <Pencil width={16} height={16} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(u)}
                    aria-label={t('delete')}
                    className="w-8 h-8 p-1.5 inline-flex items-center justify-center text-ink/60 hover:bg-neutral-50 hover:text-burgundy transition-colors duration-200 cursor-pointer"
                  >
                    <Trash2 width={16} height={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </Card>
          ))}

          {/* Add card — empty placeholder. Doubles as the EmptyState CTA. */}
          <button
            type="button"
            onClick={openCreate}
            className="border-2 border-dashed border-ink/15 p-6 flex flex-col items-center justify-center min-h-[180px] hover:border-ink/30 transition-colors duration-200 cursor-pointer text-ink/40 hover:text-ink/60"
          >
            <Plus width={24} height={24} strokeWidth={1} />
            <span className="font-body text-sm mt-3">{t('add')}</span>
          </button>
        </div>
      )}

      {/* ─── Modal ───────────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('edit') : t('new')}
        subtitle={editing ? undefined : t('modal.subtitle')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={isPending}
            >
              {tc('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit(onSubmit)}
              loading={isPending}
            >
              {editing ? t('modal.saveChanges') : t('modal.create')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Input
            label={tc('labels.name')}
            placeholder={t('form.namePlaceholder')}
            error={errors.name?.message}
            {...register('name')}
          />
          <Textarea
            label={tc('labels.description')}
            placeholder={t('form.descriptionPlaceholder')}
            rows={2}
            error={errors.description?.message}
            {...register('description')}
          />
          <Input
            type="number"
            label={t('form.priceUsd')}
            min={0}
            step={0.5}
            error={errors.priceUsd?.message}
            {...register('priceUsd')}
          />
          <Field
            label={t('form.visibility')}
            helper={t('form.visibilityHelper')}
          >
            <div className="flex items-center justify-between mt-2">
              <span className="font-body text-sm text-ink">
                {isActive ? t('form.visibleAtBooking') : t('hidden')}
              </span>
              <Toggle
                checked={isActive}
                onChange={(v) => setValue('isActive', v, { shouldDirty: true })}
                ariaLabel={t('form.toggleVisibility')}
              />
            </div>
          </Field>
        </form>
      </Modal>

      <DeleteConfirmation
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        title={t('deleteConfirm.title')}
        description={t('deleteConfirm.description')}
        confirmLabel={t('delete')}
        cancelLabel={tc('actions.cancel')}
        loading={isDeleting}
      />
    </div>
  );
}
