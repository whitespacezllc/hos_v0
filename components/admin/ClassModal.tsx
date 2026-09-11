'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import type { ClassTemplate, Instructor } from '@/types';
import { Modal } from './Modal';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Toggle } from './Toggle';
import { Field } from './Field';
import { NativeSelect } from './NativeSelect';
import { Button } from './Button';
import { ImageUpload } from './ImageUpload';

// Day-of-week options (0=Sun … 6=Sat, matching class_templates.day_of_week).
// The value is what the database stores; the label comes from the catalogue
// (admin.schedule.form.days) in the reader's language.
export const DAY_OPTIONS = [
  { value: '1', key: 'mon' },
  { value: '2', key: 'tue' },
  { value: '3', key: 'wed' },
  { value: '4', key: 'thu' },
  { value: '5', key: 'fri' },
  { value: '6', key: 'sat' },
  { value: '0', key: 'sun' },
] as const;

// The validation messages are the reader's — built inside the component,
// where the catalogue is at hand (admin.common.validation).
type SchemaMessages = {
  nameRequired: string;
  timeRequired: string;
  minMinutes: string;
  maxHours: string;
  capacityMin: string;
  priceMin: string;
  locationRequired: string;
};

const templateSchema = (msgs: SchemaMessages) =>
  z.object({
    name: z.string().min(1, msgs.nameRequired),
    description: z.string().optional(),
    instructorId: z.string(), // '' means unassigned
    dayOfWeek: z.coerce.number().min(0).max(6),
    timeStart: z.string().min(1, msgs.timeRequired),
    durationMinutes: z.coerce.number().min(15, msgs.minMinutes).max(480, msgs.maxHours),
    capacity: z.coerce.number().min(1, msgs.capacityMin),
    priceUsd: z.coerce.number().min(0, msgs.priceMin),
    location: z.string().min(1, msgs.locationRequired),
    isActive: z.boolean(),
  });

type TemplateFormValues = z.infer<ReturnType<typeof templateSchema>>;

export type TemplatePayload = {
  name: string;
  slug: string;
  description: string | null;
  instructor_id: string | null;
  day_of_week: number;
  time_start: string;
  duration_minutes: number;
  capacity: number;
  price_dropin_usd: number;
  location: string;
  image_url: string | null;
  is_active: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TemplatePayload) => void;
  template?: ClassTemplate;
  instructors: Instructor[];
  loading?: boolean;
};

const DEFAULTS: TemplateFormValues = {
  name: '',
  description: '',
  instructorId: '',
  dayOfWeek: 1,
  timeStart: '10:00',
  durationMinutes: 90,
  capacity: 20,
  priceUsd: 20,
  location: 'Open-Air Shala',
  isActive: true,
};

export default function ClassModal({
  open,
  onOpenChange,
  onSave,
  template,
  instructors,
  loading,
}: Props) {
  const isEditing = !!template;
  const t = useTranslations('admin.schedule');
  const tc = useTranslations('admin.common');

  const schema = useMemo(
    () =>
      templateSchema({
        nameRequired: tc('validation.nameRequired'),
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
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  const isActive = watch('isActive');

  // Image URL is managed outside RHF (uploaded via the ImageUpload widget).
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setImageUrl(template?.image_url ?? null);
    if (template) {
      reset({
        name: template.name,
        description: template.description ?? '',
        instructorId: template.instructor_id ?? '',
        dayOfWeek: template.day_of_week,
        timeStart: (template.time_start ?? '10:00').slice(0, 5),
        durationMinutes: template.duration_minutes,
        capacity: template.capacity,
        priceUsd: template.price_dropin_usd,
        location: template.location,
        isActive: template.is_active,
      });
    } else {
      reset(DEFAULTS);
    }
  }, [template, open, reset]);

  function onSubmit(values: TemplateFormValues) {
    onSave({
      name: values.name,
      slug:
        template?.slug ??
        values.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, ''),
      description: values.description?.trim() ? values.description : null,
      instructor_id: values.instructorId || null,
      day_of_week: values.dayOfWeek,
      time_start: values.timeStart,
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

  const dayOptions = DAY_OPTIONS.map((d) => ({ value: d.value, label: t(`form.days.${d.key}`) }));

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEditing ? t('form.editTitle') : t('form.newTitle')}
      subtitle={isEditing ? undefined : t('form.newSubtitle')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="primary" type="submit" onClick={handleSubmit(onSubmit)} loading={loading}>
            {isEditing ? t('form.saveChanges') : t('form.createClass')}
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label={t('form.className')}
          placeholder={t('form.classNamePlaceholder')}
          error={errors.name?.message}
          {...register('name')}
        />

        <Textarea
          label={tc('labels.description')}
          placeholder={t('form.descriptionPlaceholder')}
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />

        <ImageUpload
          value={imageUrl}
          onChange={setImageUrl}
          label={tc('labels.image')}
          helper={t('form.imageHelper')}
          previewAlt={tc('labels.class')}
        />

        <div className="grid grid-cols-2 gap-6">
          <NativeSelect
            label={tc('labels.instructor')}
            options={instructorOptions}
            error={errors.instructorId?.message}
            {...register('instructorId')}
          />
          <Input
            label={tc('labels.location')}
            placeholder={t('form.locationPlaceholder')}
            error={errors.location?.message}
            {...register('location')}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <NativeSelect
            label={t('form.dayOfWeek')}
            options={dayOptions}
            error={errors.dayOfWeek?.message}
            {...register('dayOfWeek')}
          />
          <Input
            type="time"
            label={t('form.startTime')}
            error={errors.timeStart?.message}
            {...register('timeStart')}
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <Input
            type="number"
            label={t('form.durationMin')}
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
            label={t('form.priceUsd')}
            min={0}
            step={5}
            error={errors.priceUsd?.message}
            {...register('priceUsd')}
          />
        </div>

        <Field label={tc('labels.status')} helper={t('form.statusHelper')}>
          <div className="flex items-center justify-between mt-2">
            <span className="font-body text-sm text-ink">
              {isActive ? tc('status.active') : tc('status.inactive')}
            </span>
            <Toggle
              checked={isActive}
              onChange={(v) => setValue('isActive', v, { shouldDirty: true })}
              ariaLabel={t('form.toggleActive')}
            />
          </div>
        </Field>
      </form>
    </Modal>
  );
}
