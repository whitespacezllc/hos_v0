'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/admin/Button';

// The panel's safety net. Without it, anything thrown while rendering an admin
// page — or by a server action a page calls — replaced the whole panel with
// Next's bare "Application error" screen, sidebar included.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tc = useTranslations('admin.common');

  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  return (
    <div className="px-6 lg:px-10 py-16 lg:py-24 max-w-xl mx-auto text-center">
      <p role="alert" className="font-body text-base text-ink">
        {tc('feedback.somethingWentWrong')}
      </p>
      <div className="mt-8 flex justify-center">
        <Button variant="primary" onClick={reset}>
          {tc('actions.retry')}
        </Button>
      </div>
      {error.digest && (
        <p className="mt-6 font-mono text-xs text-ink/40">{error.digest}</p>
      )}
    </div>
  );
}
