import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import { Navigation } from '@/components/landing/navigation';
import { Footer } from '@/components/landing/footer';
import { ShalaPolicy } from '@/components/policy/ShalaPolicy';
import { SHALA_POLICY_PATH } from '@/lib/shala-policy';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: 'shalaPolicy.meta' });
  return buildMetadata({
    path: SHALA_POLICY_PATH,
    title: t('title'),
    description: t('description'),
    locale,
  });
}

// ─── Cancellation & attendance policy ────────────────────────────────────────
// What applies to the shala's classes and activities. Linked from the footer,
// the schedule, the booking flow and every booking email.
export default async function CancellationPolicyPage({ params }: LocaleParams) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);

  return (
    <PageMessages namespaces={['shalaPolicy']}>
      <main id="main-content" className="bg-warm-white">
        <Navigation />
        <ShalaPolicy />
        <Footer />
      </main>
    </PageMessages>
  );
}
