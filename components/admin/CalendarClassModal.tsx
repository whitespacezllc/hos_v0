'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { costaRicaDateString, costaRicaInstant, costaRicaTimeString } from '@/lib/costa-rica-time';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from './Modal';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Toggle } from './Toggle';
import { Field } from './Field';
import { NativeSelect } from './NativeSelect';
import { Button } from './Button';
import { ImageUpload } from './ImageUpload';
import type { ClassInstancePayload } from '@/types';

// The subset of a serialized class the modal needs to prefill an edit.
export type EditableInstance = {
  name: string;
  description?: string;
  instructorId?: string | null;
  startsAt: string; // ISO
  durationMinutes: number;
  capacity: number;
  priceUsd: number;
  location: string;
  imageUrl?: string | null;
  isActive: boolean;
};

// The messages are the reader's — built inside the component, where the
// catalogue is at hand (admin.common.validation).
type FormErrors = {
  nameRequired: string;
  dateRequired: string;
  timeRequired: string;
  minMinutes: string;
  maxHours: string;
  capacityMin: string;
  priceMin: string;
  locationRequired: string;
};

const schema = (errors: FormErrors) =>
  z.object({
    name: z.string().min(1, errors.nameRequired),
    description: z.string().optional(),
    instructorId: z.string(), // '' = unassigned
    date: z.string().min(1, errors.dateRequired),
    time: z.string().min(1, errors.timeRequired),
    durationMinutes: z.coerce.number().min(15, errors.minMinutes).max(480, errors.maxHours),
    capacity: z.coerce.number().min(1, errors.capacityMin),
    priceUsd: z.coerce.number().min(0, errors.priceMin),
    location: z.string().min(1, errors.locationRequired),
    isActive: z.boolean(),
  });

type FormValues = z.infer<ReturnType<typeof schema>>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ClassInstancePayload) => void;
  mode: 'create' | 'edit';
  instructors: { id: string; name: string }[];
  /** Edit: the class being edited. Create: optional prefill for date/time. */
  instance?: EditableInstance;
  prefill?: { date: string; time: string };
  loading?: boolean;
};

// The form's date and time are Santa Teresa's — the class happens there, and
// the admin may be filling this in from anywhere. Reading an instant into the
// form and composing one back out both go through lib/costa-rica-time, so a
// 07:00 class is 07:00 in Costa Rica whatever the admin's laptop thinks.
const toLocalDate = (iso: string) => costaRicaDateString(iso);
const toLocalTime = (iso: string) => costaRicaTimeString(iso);

const BASE_DEFAULTS: FormValues = {
  name: '',
  description: '',
  instructorId: '',
  date: '',
  time: '10:00',
  durationMinutes: 90,
  capacity: 20,
  priceUsd: 20,
  location: 'Open-Air Shala',
  isActive: true,
};

export default function CalendarClassModal({
  open,
  onOpenChange,
  onSave,
  mode,
  instructors,
  instance,
  prefill,
  loading,
}: Props) {
  const isEditing = mode === 'edit';
  const t = useTranslations('admin.calendar.classModal');
  const tc = useTranslations('admin.common');

  const resolverSchema = useMemo(
    () =>
      schema({
        nameRequired: tc('validation.nameRequired'),
        dateRequired: tc('validation.dateRequired'),
        timeRequired: tc('validation.timeRequired'),
        minMinutes: tc('validation.minMinutes', { count: 15 }),
        maxHours: tc('validation.maxHours', { count: 8 }),
        capacityMin: tc('validation.capacityMin'),
        priceMin: tc('validation.priceMin'),
        locationRequired: tc('validation.locationRequired'),
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
  } = useForm<FormValues>({
    resolver: zodResolver(resolverSchema),
    defaultValues: BASE_DEFAULTS,
  });

  const isActive = watch('isActive');

  // Image URL is managed outside RHF (uploaded via the ImageUpload widget).
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setImageUrl(isEditing ? instance?.imageUrl ?? null : null);
    if (isEditing && instance) {
      reset({
        name: instance.name,
        description: instance.description ?? '',
        instructorId: instance.instructorId ?? '',
        date: toLocalDate(instance.startsAt),
        time: toLocalTime(instance.startsAt),
        durationMinutes: instance.durationMinutes,
        capacity: instance.capacity,
        priceUsd: instance.priceUsd,
        location: instance.location,
        isActive: instance.isActive,
      });
    } else {
      reset({
        ...BASE_DEFAULTS,
        date: prefill?.date ?? costaRicaDateString(new Date()),
        time: prefill?.time ?? BASE_DEFAULTS.time,
      });
    }
  }, [open, isEditing, instance, prefill, reset]);

  function onSubmit(values: FormValues) {
    // Compose the absolute instant from the Costa Rica date + time.
    const startsAt = costaRicaInstant(values.date, values.time);
    onSave({
      name: values.name,
      description: values.description?.trim() ? values.description : null,
      instructor_id: values.instructorId || null,
      starts_at: startsAt.toISOString(),
      duration_minutes: values.durationMinutes,
      capacity: values.capacity,
      price_dropin_usd: values.priceUsd,
      location: values.location,
      image_url: imageUrl,
      is_active: values.isActive,
    });
  }

  const instructorOptions = [
    { value: '', label: t('unassigned') },
    ...instructors.map((i) => ({ value: i.id, label: i.name })),
  ];

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEditing ? t('editTitle') : t('createTitle')}
      subtitle={isEditing ? t('editSubtitle') : t('createSubtitle')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="primary" type="submit" onClick={handleSubmit(onSubmit)} loading={loading}>
            {isEditing ? t('saveChanges') : t('createClass')}
          </Button>
        </>
      }
    >
      <form id="calendar-class-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label={t('className')}
          placeholder={t('classNamePlaceholder')}
          error={errors.name?.message}
          {...register('name')}
        />

        <Textarea
          label={tc('labels.description')}
          placeholder={t('descriptionPlaceholder')}
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />

        <ImageUpload value={imageUrl} onChange={setImageUrl} />

        <div className="grid grid-cols-2 gap-6">
          <NativeSelect
            label={tc('labels.instructor')}
            options={instructorOptions}
            error={errors.instructorId?.message}
            {...register('instructorId')}
          />
          <Input
            label={tc('labels.location')}
            placeholder={t('locationPlaceholder')}
            error={errors.location?.message}
            {...register('location')}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Input
            type="date"
            label={tc('labels.date')}
            error={errors.date?.message}
            {...register('date')}
          />
          <Input
            type="time"
            label={t('startTime')}
            error={errors.time?.message}
            {...register('time')}
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <Input
            type="number"
            label={t('durationMin')}
            min={15}
            max={480}
            error={errors.durationMinutes?.message}
            {...register('durationMinutes')}
          />
          <Input
            type="number"
            label={tc('labels.capacity')}
            min={1}
            error={errors.capacity?.message}
            {...register('capacity')}
          />
          <Input
            type="number"
            label={t('priceUsd')}
            min={0}
            step={5}
            error={errors.priceUsd?.message}
            {...register('priceUsd')}
          />
        </div>

        <Field label={tc('labels.status')} helper={t('statusHelper')}>
          <div className="flex items-center justify-between mt-2">
            <span className="font-body text-sm text-ink">
              {isActive ? tc('status.active') : tc('status.inactive')}
            </span>
            <Toggle
              checked={isActive}
              onChange={(v) => setValue('isActive', v, { shouldDirty: true })}
              ariaLabel={t('toggleActive')}
            />
          </div>
        </Field>
      </form>
    </Modal>
  );
}
