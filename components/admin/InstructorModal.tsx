'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2, Check, X as XIcon } from 'lucide-react';
import type { Instructor } from '@/types';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { DeleteConfirmation } from './DeleteConfirmation';
import { RowIconButton } from '@/app/admin/clases/_components/ClasesClient';
import {
  createInstructor,
  updateInstructor,
  deleteInstructor,
} from '@/app/actions/instructors';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructors: Instructor[];
  onChanged: () => void; // parent refreshes the server data
};

type Draft = { name: string; email: string };
const EMPTY_DRAFT: Draft = { name: '', email: '' };

// The one error the instructor actions raise on purpose (a delete blocked
// because the instructor still has classes); everything else is a database
// message, which the reader gets as a generic line in their language.
const IN_USE_ERROR =
  'This instructor is assigned to classes. Reassign or remove those classes first.';

export default function InstructorModal({
  open,
  onOpenChange,
  instructors,
  onChanged,
}: Props) {
  const t = useTranslations('admin.schedule.instructors');
  const tc = useTranslations('admin.common');
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Instructor | null>(null);

  function resetForm() {
    setFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function startAdd() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setFormOpen(true);
  }

  function startEdit(i: Instructor) {
    setEditingId(i.id);
    setDraft({ name: i.name, email: i.email ?? '' });
    setError(null);
    setFormOpen(true);
  }

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      setError(t('nameRequired'));
      return;
    }
    const payload = { name, email: draft.email.trim() || null };
    startTransition(async () => {
      const res = editingId
        ? await updateInstructor(editingId, payload)
        : await createInstructor(payload);
      if (!res.ok) {
        setError(tc('feedback.couldNotSave'));
        return;
      }
      resetForm();
      onChanged();
    });
  }

  function handleConfirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteInstructor(deleting.id);
      if (!res.ok) {
        setError(res.error === IN_USE_ERROR ? t('inUse') : tc('feedback.couldNotDelete'));
        setDeleting(null);
        return;
      }
      setDeleting(null);
      onChanged();
    });
  }

  return (
    <>
      <Modal
        isOpen={open}
        onClose={() => {
          resetForm();
          onOpenChange(false);
        }}
        title={t('title')}
        subtitle={t('subtitle')}
        maxWidth="max-w-lg"
        footer={
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
            {tc('actions.done')}
          </Button>
        }
      >
        {/* Global error (e.g. delete blocked because instructor is in use) */}
        {error && !formOpen && (
          <p className="font-body text-xs italic text-burgundy mb-4">{error}</p>
        )}

        {/* List */}
        {instructors.length === 0 ? (
          <p className="font-body text-sm text-ink/50 py-2">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-ink/[0.08] border-t border-ink/10">
            {instructors.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-medium text-ink truncate">{i.name}</p>
                  {i.email && (
                    <p className="font-body text-xs text-ink/50 truncate mt-0.5">{i.email}</p>
                  )}
                </div>
                <RowIconButton ariaLabel={t('edit')} onClick={() => startEdit(i)} disabled={isPending}>
                  <Pencil width={16} height={16} strokeWidth={1.5} />
                </RowIconButton>
                <RowIconButton
                  ariaLabel={t('delete')}
                  onClick={() => {
                    setError(null);
                    setDeleting(i);
                  }}
                  disabled={isPending}
                  hoverDestructive
                >
                  <Trash2 width={16} height={16} strokeWidth={1.5} />
                </RowIconButton>
              </li>
            ))}
          </ul>
        )}

        {/* Inline add/edit form */}
        {formOpen ? (
          <div className="mt-6 pt-6 border-t border-ink/10 space-y-4">
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-ink/60">
              {editingId ? t('edit') : t('new')}
            </p>
            <Input
              label={tc('labels.name')}
              placeholder={t('namePlaceholder')}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              error={error ?? undefined}
            />
            <Input
              label={t('emailOptional')}
              type="email"
              placeholder={t('emailPlaceholder')}
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            />
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                icon={<Check width={16} height={16} strokeWidth={1.5} />}
                onClick={handleSubmit}
                loading={isPending}
              >
                {editingId ? tc('actions.save') : tc('actions.add')}
              </Button>
              <Button
                variant="tertiary"
                icon={<XIcon width={16} height={16} strokeWidth={1.5} />}
                onClick={resetForm}
                disabled={isPending}
              >
                {tc('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 pt-6 border-t border-ink/10">
            <Button
              variant="secondary"
              icon={<Plus width={16} height={16} strokeWidth={1.5} />}
              onClick={startAdd}
              disabled={isPending}
            >
              {t('add')}
            </Button>
          </div>
        )}
      </Modal>

      <DeleteConfirmation
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        title={t('deleteTitle')}
        description={t('deleteDescription', { name: deleting?.name ?? t('thisInstructor') })}
        confirmLabel={t('delete')}
        cancelLabel={tc('actions.cancel')}
        loading={isPending}
      />
    </>
  );
}
