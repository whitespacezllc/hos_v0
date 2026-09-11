'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Check } from 'lucide-react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Field } from './Field';
import { NativeSelect } from './NativeSelect';
import { Toggle } from './Toggle';
import { Button } from './Button';

// Admin quick-add for a walk-in participant. Mirrors the public booking form's
// personal fields (name, email, phone, hotel guest + Cloudbeds ref) so a
// manually-added student looks just like a web booking — but skips the multi-
// step upsell/pack flow: it's an express add for someone standing at reception.
//
// The messages are the reader's — built inside the component, where the
// catalogue is at hand.
type FormErrors = {
  firstNameRequired: string;
  lastNameRequired: string;
  emailInvalid: string;
  atLeastOne: string;
  tooMany: string;
};

const schema = (errors: FormErrors) =>
  z.object({
    firstName: z.string().min(1, errors.firstNameRequired),
    lastName: z.string().min(1, errors.lastNameRequired),
    email: z.string().email(errors.emailInvalid),
    phone: z.string().optional(),
    persons: z.coerce.number().min(1, errors.atLeastOne).max(20, errors.tooMany),
    paymentMethod: z.enum(['cash', 'venmo', 'card']),
    markPaid: z.boolean(),
    isHotelGuest: z.boolean(),
    cloudbedsRef: z.string().optional(),
  });

type FormValues = z.infer<ReturnType<typeof schema>>;

export type UpsellOption = { id: string; name: string; priceUsd: number };

// Upsell selection lives outside the zod schema (it's a simple id list managed
// with local state), so the submitted payload merges the two.
export type AddParticipantValues = FormValues & { upsellIds: string[] };

const DEFAULTS: FormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  persons: 1,
  paymentMethod: 'cash',
  markPaid: true,
  isHotelGuest: false,
  cloudbedsRef: '',
};

// The values are what the database stores; the labels come from
// admin.common.paymentMethod.
const PAYMENT_METHODS = ['cash', 'venmo', 'card'] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AddParticipantValues) => void;
  className: string;
  spotsRemaining: number;
  priceUsd: number;
  upsells: UpsellOption[];
  loading?: boolean;
  error?: string | null;
};

export default function AddParticipantModal({
  open,
  onOpenChange,
  onSubmit,
  className,
  spotsRemaining,
  priceUsd,
  upsells,
  loading,
  error,
}: Props) {
  const t = useTranslations('admin.calendar.participantModal');
  const tc = useTranslations('admin.common');

  const resolverSchema = useMemo(
    () =>
      schema({
        firstNameRequired: t('validation.firstNameRequired'),
        lastNameRequired: t('validation.lastNameRequired'),
        emailInvalid: tc('validation.emailInvalid'),
        atLeastOne: tc('validation.atLeastOne'),
        tooMany: tc('validation.tooMany'),
      }),
    [t, tc],
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
    defaultValues: DEFAULTS,
  });

  const paymentOptions = PAYMENT_METHODS.map((value) => ({
    value,
    label: tc(`paymentMethod.${value}`),
  }));

  // Upsell selection — a plain id list, merged into the payload on submit.
  const [selectedUpsells, setSelectedUpsells] = useState<string[]>([]);

  const isHotelGuest = watch('isHotelGuest');
  const markPaid = watch('markPaid');
  const persons = watch('persons');

  // Reset the form + upsell selection each time the modal opens.
  useEffect(() => {
    if (open) {
      reset(DEFAULTS);
      setSelectedUpsells([]);
    }
  }, [open, reset]);

  function toggleUpsell(id: string) {
    setSelectedUpsells((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const upsellsTotal = useMemo(
    () =>
      upsells
        .filter((u) => selectedUpsells.includes(u.id))
        .reduce((acc, u) => acc + u.priceUsd, 0),
    [upsells, selectedUpsells],
  );

  const total = priceUsd * (Number(persons) || 1) + upsellsTotal;

  const submit = handleSubmit((values) =>
    onSubmit({ ...values, upsellIds: selectedUpsells }),
  );

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={t('title')}
      subtitle={t('subtitle', { className, count: spotsRemaining })}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="primary" type="submit" onClick={submit} loading={loading}>
            {t('submit')}
          </Button>
        </>
      }
    >
      <form id="add-participant-form" onSubmit={submit} className="space-y-6">
        {error && (
          <div className="flex items-start gap-2 bg-burgundy/5 border border-burgundy/20 px-4 py-3">
            <AlertCircle
              width={16}
              height={16}
              strokeWidth={1.5}
              className="text-burgundy flex-shrink-0 mt-0.5"
            />
            <p className="font-body text-sm text-burgundy">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <Input
            label={tc('labels.firstName')}
            placeholder={t('firstNamePlaceholder')}
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Input
            label={tc('labels.lastName')}
            placeholder={t('lastNamePlaceholder')}
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        <Input
          type="email"
          label={tc('labels.email')}
          placeholder={t('emailPlaceholder')}
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="grid grid-cols-2 gap-6">
          <Input
            type="tel"
            label={t('phoneOptional')}
            placeholder={t('phonePlaceholder')}
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Input
            type="number"
            label={tc('labels.people')}
            min={1}
            max={20}
            error={errors.persons?.message}
            {...register('persons')}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <NativeSelect
            label={t('paymentMethod')}
            options={paymentOptions}
            error={errors.paymentMethod?.message}
            {...register('paymentMethod')}
          />
          <Field
            label={t('alreadyPaid')}
            helper={markPaid ? t('paidHelper') : t('pendingHelper')}
          >
            <div className="flex items-center justify-between mt-2">
              <span className="font-body text-sm text-ink">{markPaid ? tc('status.paid') : tc('status.pending')}</span>
              <Toggle
                checked={markPaid}
                onChange={(v) => setValue('markPaid', v, { shouldDirty: true })}
                ariaLabel={t('togglePaid')}
              />
            </div>
          </Field>
        </div>

        <Field label={t('hotelGuest')} helper={t('hotelGuestHelper')}>
          <div className="flex items-center justify-between mt-2">
            <span className="font-body text-sm text-ink">{isHotelGuest ? tc('actions.yes') : tc('actions.no')}</span>
            <Toggle
              checked={isHotelGuest}
              onChange={(v) => setValue('isHotelGuest', v, { shouldDirty: true })}
              ariaLabel={t('toggleHotelGuest')}
            />
          </div>
        </Field>

        {isHotelGuest && (
          <Input
            label={t('cloudbedsRef')}
            placeholder={t('cloudbedsPlaceholder')}
            error={errors.cloudbedsRef?.message}
            {...register('cloudbedsRef')}
          />
        )}

        {upsells.length > 0 && (
          <Field label={tc('labels.extras')} helper={t('extrasHelper')}>
            <div className="mt-2 space-y-2">
              {upsells.map((u) => {
                const checked = selectedUpsells.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUpsell(u.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 border text-left transition-colors duration-200 cursor-pointer ${
                      checked
                        ? 'border-burgundy bg-burgundy/5'
                        : 'border-ink/15 hover:border-ink/30'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        aria-hidden
                        className={`flex items-center justify-center w-4 h-4 flex-shrink-0 border ${
                          checked ? 'bg-burgundy border-burgundy text-cream' : 'border-ink/30'
                        }`}
                      >
                        {checked && <Check width={12} height={12} strokeWidth={2} />}
                      </span>
                      <span className="font-body text-sm text-ink truncate">{u.name}</span>
                    </span>
                    <span className="font-body text-sm text-ink/70 flex-shrink-0">
                      {t('upsellPrice', { amount: u.priceUsd })}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {total > 0 && (
          <div className="flex justify-between items-center bg-neutral-50 px-4 py-3">
            <span className="font-body text-sm text-ink/60">{tc('labels.total')}</span>
            <span className="font-body text-base font-medium text-ink">{tc('units.usd', { amount: total })}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
