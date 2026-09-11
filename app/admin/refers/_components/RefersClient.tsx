'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { costaRicaDateString, inCostaRica } from '@/lib/costa-rica-time';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { dateFnsLocale } from '@/lib/dates';
import type { AppLocale } from '@/i18n/routing';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Ticket,
  Percent,
  DollarSign,
  Gift,
  TrendingUp,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';
import type { Upsell } from '@/types';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/admin/Card';
import { Button } from '@/components/admin/Button';
import { Badge } from '@/components/admin/Badge';
import { EmptyState } from '@/components/admin/EmptyState';
import { DeleteConfirmation } from '@/components/admin/DeleteConfirmation';
import { Modal } from '@/components/admin/Modal';
import { Input } from '@/components/admin/Input';
import { NativeSelect } from '@/components/admin/NativeSelect';
import { Field } from '@/components/admin/Field';
import {
  createReferralCode,
  updateReferralCode,
  toggleReferralCodeActive,
  deleteReferralCode,
} from '@/app/actions/referralCodes';

// Earth-tone palette references — same hex as DESIGN_SYSTEM.md.
const COLORS = { sage: '#6B7355', terracotta: '#8B6F47' } as const;

type SerializedReferralCode = {
  id: string;
  code: string;
  partnerName: string;
  description: string;
  benefitType: 'percentage' | 'fixed' | 'free_upsell';
  discountPercent?: number;
  discountFixed?: number;
  freeUpsellId?: string;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  minPurchaseUsd: number;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
};

// The validation copy comes from the catalogue, so the schema is built per
// language (same pattern as BookingFlow's personalSchema).
type CodeSchemaMessages = {
  codeMin: string;
  codeMax: string;
  partnerNameRequired: string;
  descriptionRequired: string;
  percentRange: string;
  fixedMin: string;
  usageLimitMin: string;
  minPurchaseMin: string;
};

const codeSchema = (m: CodeSchemaMessages) =>
  z.object({
    code: z.string().min(2, m.codeMin).max(30, m.codeMax).toUpperCase(),
    partnerName: z.string().min(1, m.partnerNameRequired),
    description: z.string().min(1, m.descriptionRequired),
    benefitType: z.enum(['percentage', 'fixed', 'free_upsell']),
    discountPercent: z.coerce.number().min(1, m.percentRange).max(100, m.percentRange).optional(),
    discountFixed: z.coerce.number().min(0.5, m.fixedMin).optional(),
    freeUpsellId: z.string().optional(),
    usageLimit: z.coerce.number().min(1, m.usageLimitMin).optional().or(z.literal('')),
    minPurchaseUsd: z.coerce.number().min(0, m.minPurchaseMin),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
  });
type CodeForm = z.infer<ReturnType<typeof codeSchema>>;

function benefitIcon(type: SerializedReferralCode['benefitType']): LucideIcon {
  if (type === 'percentage') return Percent;
  if (type === 'fixed') return DollarSign;
  return Gift;
}

// ═══════════════════════════════════════════════════════════════════════════
export default function RefersClient({
  initialCodes,
  upsells,
}: {
  initialCodes: SerializedReferralCode[];
  upsells: Upsell[];
}) {
  const t = useTranslations('admin.promo');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedReferralCode | null>(null);
  const [deleting, setDeleting] = useState<SerializedReferralCode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalCodes = initialCodes.length;
  const activeCodes = initialCodes.filter((c) => c.isActive).length;
  const totalUses = initialCodes.reduce((acc, c) => acc + c.usageCount, 0);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(code: SerializedReferralCode) {
    setEditing(code);
    setModalOpen(true);
  }

  function handleSave(data: CodeForm) {
    const payload = {
      code: data.code,
      partnerName: data.partnerName,
      description: data.description,
      benefitType: data.benefitType,
      discountPercent: data.benefitType === 'percentage' ? Number(data.discountPercent) : undefined,
      discountFixed: data.benefitType === 'fixed' ? Number(data.discountFixed) : undefined,
      freeUpsellId: data.benefitType === 'free_upsell' ? data.freeUpsellId : undefined,
      isActive: true,
      usageLimit:
        data.usageLimit !== '' && data.usageLimit !== undefined
          ? Number(data.usageLimit)
          : undefined,
      minPurchaseUsd: Number(data.minPurchaseUsd),
      validFrom: data.validFrom || undefined,
      validUntil: data.validUntil || undefined,
    };
    startTransition(async () => {
      if (editing) {
        await updateReferralCode(editing.id, payload);
      } else {
        await createReferralCode(payload);
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleReferralCodeActive(id);
      router.refresh();
    });
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteReferralCode(deleting.id);
      setDeleting(null);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-6xl mx-auto">
      <PageHeader
        heading={t('heading')}
        description={t('description')}
        actions={
          <Button
            variant="primary"
            icon={<Plus width={16} height={16} strokeWidth={1.5} />}
            onClick={openCreate}
          >
            {t('newCode')}
          </Button>
        }
      />

      {/* Stats — 3 cards (the legacy 'Socios' / Partners stat was dropped) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Ticket} color={COLORS.sage} value={totalCodes} label={t('stats.total')} />
        <StatCard icon={CheckCircle} color={COLORS.sage} value={activeCodes} label={t('stats.active')} />
        <StatCard icon={TrendingUp} color={COLORS.terracotta} value={totalUses} label={t('stats.uses')} />
      </div>

      {/* Codes list */}
      {initialCodes.length === 0 ? (
        <EmptyState
          icon={<Ticket strokeWidth={1} />}
          heading={t('empty.heading')}
          description={t('empty.description')}
          action={
            <Button
              variant="primary"
              icon={<Plus width={16} height={16} strokeWidth={1.5} />}
              onClick={openCreate}
            >
              {t('newCode')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {initialCodes.map((code) => (
            <CodeRow
              key={code.id}
              code={code}
              upsells={upsells}
              isPending={isPending}
              onToggle={() => handleToggle(code.id)}
              onEdit={() => openEdit(code)}
              onDelete={() => setDeleting(code)}
            />
          ))}
        </div>
      )}

      <CodeModal
        open={modalOpen}
        editing={editing}
        upsells={upsells}
        isPending={isPending}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <DeleteConfirmation
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        title={t('delete.title')}
        description={
          deleting
            ? t('delete.descriptionWithCode', { code: deleting.code })
            : t('delete.description')
        }
        confirmLabel={t('delete.confirm')}
        loading={isDeleting}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Stat card (3 stats on Promo codes — mirrors the Dashboard stat pattern)
// ═══════════════════════════════════════════════════════════════════════════
function StatCard({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: LucideIcon;
  color: string;
  value: number;
  label: string;
}) {
  return (
    <Card padding="tight">
      <div
        aria-hidden
        className="w-8 h-8 flex items-center justify-center"
        style={{ background: `${color}1A` }}
      >
        <Icon width={16} height={16} strokeWidth={1.5} style={{ color }} />
      </div>
      <p className="font-body text-3xl font-light text-ink leading-none mt-4">{value}</p>
      <p className="font-body text-xs text-ink/60 mt-1">{label}</p>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Code row
// ═══════════════════════════════════════════════════════════════════════════
function CodeRow({
  code,
  upsells,
  isPending,
  onToggle,
  onEdit,
  onDelete,
}: {
  code: SerializedReferralCode;
  upsells: Upsell[];
  isPending: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('admin.promo');
  const dfLocale = dateFnsLocale(useLocale() as AppLocale);
  const Icon = benefitIcon(code.benefitType);
  const isExpired = !!code.validUntil && new Date() > inCostaRica(code.validUntil);

  // Month names come from date-fns, so the patterns live in the catalogue
  // (Spanish puts the day before the month).
  const fmtShort = (iso: string) => format(inCostaRica(iso), t('dates.short'), { locale: dfLocale });
  const fmtMonthDay = (iso: string) => format(inCostaRica(iso), t('dates.monthDay'), { locale: dfLocale });
  const validityLabel =
    code.validUntil && !code.validFrom
      ? t('row.until', { date: fmtShort(code.validUntil) })
      : code.validUntil && code.validFrom
      ? t('row.range', { from: fmtMonthDay(code.validFrom), until: fmtShort(code.validUntil) })
      : t('row.noExpiration');

  let benefitLabel: string;
  if (code.benefitType === 'percentage') {
    benefitLabel = t('benefit.percentOff', { percent: code.discountPercent ?? 0 });
  } else if (code.benefitType === 'fixed') {
    benefitLabel = t('benefit.fixedOff', { amount: code.discountFixed ?? 0 });
  } else {
    const upsell = upsells.find((u) => u.id === code.freeUpsellId);
    benefitLabel = upsell ? t('benefit.freeNamed', { name: upsell.name }) : t('benefit.free');
  }

  return (
    <Card>
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Icon */}
        <div className="w-12 h-12 bg-neutral-50 flex items-center justify-center flex-shrink-0">
          <Icon width={18} height={18} strokeWidth={1.5} className="text-ink/60" />
        </div>

        {/* Identifier */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium text-ink bg-neutral-50 px-2 py-1">
              {code.code}
            </span>
            {!code.isActive && <Badge variant="inactive">{t('row.inactive')}</Badge>}
            {isExpired && <Badge variant="destructive">{t('row.expired')}</Badge>}
          </div>
          <p className="font-body text-xs text-ink/50 mt-1 truncate">
            {code.description}
          </p>
        </div>

        {/* Benefit */}
        <div className="lg:w-40">
          <p className="font-body text-[10px] tracking-[0.2em] uppercase text-ink/50">
            {t('row.benefit')}
          </p>
          <p className="font-body text-sm font-medium text-ink mt-1">
            {benefitLabel}
          </p>
        </div>

        {/* Uses */}
        <div className="lg:w-24">
          <p className="font-body text-[10px] tracking-[0.2em] uppercase text-ink/50">
            {t('row.uses')}
          </p>
          <p className="font-body text-sm font-medium text-ink mt-1">
            {code.usageCount}
            {code.usageLimit ? ` / ${code.usageLimit}` : ''}
          </p>
        </div>

        {/* Validity */}
        <div className="lg:w-40">
          <p
            className={`font-body text-sm ${
              isExpired ? 'text-ink/40 italic' : 'text-ink/70'
            }`}
          >
            {validityLabel}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 lg:ml-auto">
          <button
            type="button"
            onClick={onToggle}
            disabled={isPending}
            aria-label={code.isActive ? t('row.deactivate') : t('row.activate')}
            className="w-8 h-8 p-1.5 inline-flex items-center justify-center text-ink/60 hover:bg-neutral-50 hover:text-ink transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {code.isActive ? (
              <Eye width={16} height={16} strokeWidth={1.5} />
            ) : (
              <EyeOff width={16} height={16} strokeWidth={1.5} />
            )}
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('row.edit')}
            className="w-8 h-8 p-1.5 inline-flex items-center justify-center text-ink/60 hover:bg-neutral-50 hover:text-ink transition-colors duration-200 cursor-pointer"
          >
            <Pencil width={16} height={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t('row.delete')}
            className="w-8 h-8 p-1.5 inline-flex items-center justify-center text-ink/60 hover:bg-neutral-50 hover:text-burgundy transition-colors duration-200 cursor-pointer"
          >
            <Trash2 width={16} height={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Create / Edit modal
// ═══════════════════════════════════════════════════════════════════════════
function CodeModal({
  open,
  editing,
  upsells,
  isPending,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: SerializedReferralCode | null;
  upsells: Upsell[];
  isPending: boolean;
  onClose: () => void;
  onSave: (data: CodeForm) => void;
}) {
  const t = useTranslations('admin.promo');
  const tc = useTranslations('admin.common');
  const activeUpsells = upsells.filter((u) => u.isActive);
  const isEditing = !!editing;

  const schema = useMemo(
    () =>
      codeSchema({
        codeMin: t('validation.codeMin'),
        codeMax: t('validation.codeMax'),
        partnerNameRequired: t('validation.partnerNameRequired'),
        descriptionRequired: tc('validation.descriptionRequired'),
        percentRange: t('validation.percentRange'),
        fixedMin: t('validation.fixedMin'),
        usageLimitMin: tc('validation.atLeastOne'),
        minPurchaseMin: t('validation.minPurchaseMin'),
      }),
    [t, tc],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CodeForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      partnerName: '',
      description: '',
      benefitType: 'percentage',
      discountPercent: 10,
      freeUpsellId: activeUpsells[0]?.id ?? '',
      usageLimit: '',
      minPurchaseUsd: 0,
      validFrom: '',
      validUntil: '',
    },
  });

  const benefitType = watch('benefitType');

  // Reset whenever the modal opens with new context (create vs edit).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        code: editing.code,
        partnerName: editing.partnerName,
        description: editing.description,
        benefitType: editing.benefitType,
        discountPercent: editing.discountPercent ?? 10,
        discountFixed: editing.discountFixed,
        freeUpsellId: editing.freeUpsellId ?? activeUpsells[0]?.id ?? '',
        usageLimit: editing.usageLimit ?? '',
        minPurchaseUsd: editing.minPurchaseUsd,
        validFrom: editing.validFrom
          ? costaRicaDateString(editing.validFrom)
          : '',
        validUntil: editing.validUntil
          ? costaRicaDateString(editing.validUntil)
          : '',
      });
    } else {
      reset({
        code: '',
        partnerName: '',
        description: '',
        benefitType: 'percentage',
        discountPercent: 10,
        freeUpsellId: activeUpsells[0]?.id ?? '',
        usageLimit: '',
        minPurchaseUsd: 0,
        validFrom: '',
        validUntil: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEditing ? t('modal.titleEdit') : t('modal.titleNew')}
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            {tc('actions.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(onSave)}
            loading={isPending}
          >
            {isEditing ? t('modal.saveChanges') : t('modal.create')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSave)} className="space-y-6">
        {/* Identifier */}
        <Input
          label={tc('labels.code')}
          placeholder={t('fields.codePlaceholder')}
          error={errors.code?.message}
          className="font-mono uppercase"
          {...register('code', {
            onChange: (e) => setValue('code', e.target.value.toUpperCase()),
          })}
        />
        <Input
          label={t('fields.partnerName')}
          placeholder={t('fields.partnerNamePlaceholder')}
          error={errors.partnerName?.message}
          {...register('partnerName')}
        />
        <Input
          label={t('fields.internalDescription')}
          placeholder={t('fields.internalDescriptionPlaceholder')}
          error={errors.description?.message}
          {...register('description')}
        />

        {/* Benefit type — segmented buttons */}
        <Field label={t('fields.benefitType')}>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(
              [
                { value: 'percentage', icon: Percent, label: t('fields.typePercent') },
                { value: 'fixed', icon: DollarSign, label: t('fields.typeFixed') },
                { value: 'free_upsell', icon: Gift, label: t('fields.typeFreeUpsell') },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const selected = benefitType === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() =>
                    setValue('benefitType', opt.value, { shouldDirty: true })
                  }
                  className={`
                    flex flex-col items-center gap-1.5 py-3 px-2 border
                    font-body text-xs transition-colors duration-200 cursor-pointer
                    ${
                      selected
                        ? 'border-ink bg-ink/[0.04] text-ink font-medium'
                        : 'border-ink/15 text-ink/60 hover:border-ink/30'
                    }
                  `}
                >
                  <Icon width={16} height={16} strokeWidth={1.5} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Benefit value — conditional */}
        {benefitType === 'percentage' && (
          <Input
            type="number"
            label={t('fields.discountPercent')}
            min={1}
            max={100}
            placeholder="10"
            error={errors.discountPercent?.message}
            {...register('discountPercent')}
          />
        )}
        {benefitType === 'fixed' && (
          <Input
            type="number"
            label={t('fields.discountFixed')}
            min={0.5}
            step={0.5}
            placeholder="5"
            error={errors.discountFixed?.message}
            {...register('discountFixed')}
          />
        )}
        {benefitType === 'free_upsell' && (
          <NativeSelect
            label={t('fields.freeUpsell')}
            options={activeUpsells.map((u) => ({
              value: u.id,
              label: t('fields.upsellOption', { name: u.name, price: u.priceUsd }),
            }))}
            error={errors.freeUpsellId?.message}
            {...register('freeUpsellId')}
          />
        )}

        {/* Limits */}
        <div className="grid grid-cols-2 gap-6">
          <Input
            type="number"
            label={t('fields.minPurchase')}
            min={0}
            step={1}
            placeholder="0"
            error={errors.minPurchaseUsd?.message}
            {...register('minPurchaseUsd')}
          />
          <Input
            type="number"
            label={t('fields.usageLimit')}
            min={1}
            step={1}
            placeholder={t('fields.unlimited')}
            {...register('usageLimit')}
          />
        </div>

        {/* Validity */}
        <div className="grid grid-cols-2 gap-6">
          <Input type="date" label={t('fields.validFrom')} {...register('validFrom')} />
          <Input type="date" label={t('fields.validUntil')} {...register('validUntil')} />
        </div>
      </form>
    </Modal>
  );
}
