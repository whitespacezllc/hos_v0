'use client';

import { useEffect, useState } from 'react';
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

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  instructorId: z.string(), // '' = unassigned
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  durationMinutes: z.coerce.number().min(15, 'Minimum 15 minutes').max(480, 'Maximum 8 hours'),
  capacity: z.coerce.number().min(1, 'Capacity must be at least 1'),
  priceUsd: z.coerce.number().min(0, "Price can't be negative"),
  location: z.string().min(1, 'Location is required'),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

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

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
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
    { value: '', label: 'Unassigned' },
    ...instructors.map((i) => ({ value: i.id, label: i.name })),
  ];

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEditing ? 'Edit class' : 'New class'}
      subtitle={
        isEditing
          ? 'Changes apply to this single session only.'
          : 'A one-off session on a specific date and time.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" onClick={handleSubmit(onSubmit)} loading={loading}>
            {isEditing ? 'Save changes' : 'Create class'}
          </Button>
        </>
      }
    >
      <form id="calendar-class-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label="Class name"
          placeholder="Ex: Sunrise Vinyasa"
          error={errors.name?.message}
          {...register('name')}
        />

        <Textarea
          label="Description"
          placeholder="Short description of the class..."
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />

        <ImageUpload value={imageUrl} onChange={setImageUrl} />

        <div className="grid grid-cols-2 gap-6">
          <NativeSelect
            label="Instructor"
            options={instructorOptions}
            error={errors.instructorId?.message}
            {...register('instructorId')}
          />
          <Input
            label="Location"
            placeholder="Open-Air Shala"
            error={errors.location?.message}
            {...register('location')}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Input
            type="date"
            label="Date"
            error={errors.date?.message}
            {...register('date')}
          />
          <Input
            type="time"
            label="Start time · Costa Rica"
            error={errors.time?.message}
            {...register('time')}
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <Input
            type="number"
            label="Duration (min)"
            min={15}
            max={480}
            error={errors.durationMinutes?.message}
            {...register('durationMinutes')}
          />
          <Input
            type="number"
            label="Capacity"
            min={1}
            error={errors.capacity?.message}
            {...register('capacity')}
          />
          <Input
            type="number"
            label="Price (USD)"
            min={0}
            step={5}
            error={errors.priceUsd?.message}
            {...register('priceUsd')}
          />
        </div>

        <Field label="Status" helper="Inactive classes don't appear on the public site.">
          <div className="flex items-center justify-between mt-2">
            <span className="font-body text-sm text-ink">
              {isActive ? 'Active' : 'Inactive'}
            </span>
            <Toggle
              checked={isActive}
              onChange={(v) => setValue('isActive', v, { shouldDirty: true })}
              ariaLabel="Toggle active status"
            />
          </div>
        </Field>
      </form>
    </Modal>
  );
}
