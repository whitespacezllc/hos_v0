import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildMetadata } from '@/lib/seo';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import { BOOK_PATH } from '@/lib/cloudbeds';
import BookPageClient from './BookPageClient';

// /book — the rooms. The Cloudbeds booking engine rendered in the page
// (lib/cloudbeds.ts), under the site's own navigation and above its footer.
// Not to be confused with /booking/[classId], which books a yoga class.
//
// Static in both languages like every other public page; the stay a reader
// arrives with (`?checkin=…&checkout=…`) is read by the engine in the
// browser, so nothing here depends on the request.
export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: 'book.meta' });
  return buildMetadata({
    path: BOOK_PATH,
    title: t('title'),
    description: t('description'),
    locale,
  });
}

export default async function BookPage({ params }: LocaleParams) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);

  return (
    <PageMessages namespaces={['book']}>
      <BookPageClient />
    </PageMessages>
  );
}
