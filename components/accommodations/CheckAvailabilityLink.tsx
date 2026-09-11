'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BOOK_PATH } from '@/lib/cloudbeds';

// ─── Editorial "Check availability" link ─────────────────────────────────────
// Under each dwelling on /stay-with-us and inside its lightbox. A plain link
// to /book, where the Cloudbeds engine renders in the page (lib/cloudbeds.ts):
// nothing to load here, nothing to fall back from, and a cmd-click opens the
// engine in a new tab like any other page.
export function CheckAvailabilityLink({
  label,
  className = 'mt-6',
}: {
  /** Defaults to the site-wide "Check availability". */
  label?: string;
  className?: string;
}) {
  const t = useTranslations('common.buttons');
  return (
    <Link
      href={BOOK_PATH}
      className={`inline-block font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300 cursor-pointer ${className}`}
    >
      {label ?? t('checkAvailability')}
    </Link>
  );
}
