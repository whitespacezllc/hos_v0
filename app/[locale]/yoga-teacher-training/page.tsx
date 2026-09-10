import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import { FaqJsonLd } from '@/components/seo/JsonLd';
import { Navigation } from '@/components/landing/navigation';
import { Footer } from '@/components/landing/footer';
import { YTTHero } from '@/components/yoga-teacher-training/YTTHero';
import { YTTIntro } from '@/components/yoga-teacher-training/YTTIntro';
import { YTTDifferent } from '@/components/yoga-teacher-training/YTTDifferent';
import { YTTPathway } from '@/components/yoga-teacher-training/YTTPathway';
import { YTTCurriculum } from '@/components/yoga-teacher-training/YTTCurriculum';
import { YTTTestimonial } from '@/components/yoga-teacher-training/YTTTestimonial';
import { YTTIncluded } from '@/components/yoga-teacher-training/YTTIncluded';
import { YTTRhythm } from '@/components/yoga-teacher-training/YTTRhythm';
import { YTTTeachers } from '@/components/yoga-teacher-training/YTTTeachers';
import { YTTSanctuary } from '@/components/yoga-teacher-training/YTTSanctuary';
import { YTTWhoFor } from '@/components/yoga-teacher-training/YTTWhoFor';
import { YTTPricing } from '@/components/yoga-teacher-training/YTTPricing';
import { YTTOutcomes } from '@/components/yoga-teacher-training/YTTOutcomes';
import { YTTFaq } from '@/components/yoga-teacher-training/YTTFaq';
import { YTTClosingCTA } from '@/components/yoga-teacher-training/YTTClosingCTA';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: 'ytt.meta' });
  return buildMetadata({
    path: '/yoga-teacher-training',
    title: t('title'),
    description: t('description'),
    locale,
  });
}

// Anchor targets, kept so the links already circulating — /yoga-teacher-training
// #curriculum and the rest — still land on the right section. The offset clears
// the fixed navbar so a jumped-to heading is never tucked underneath it.
const ANCHOR = 'scroll-mt-20 lg:scroll-mt-28';

export default async function YogaTeacherTrainingPage({ params }: LocaleParams) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <PageMessages namespaces={['ytt']}>
      <FaqJsonLd items={messages.ytt.faq.items.map((i) => ({ question: i.q, answer: i.a }))} />
    <main id="main-content" className="bg-warm-white overflow-hidden">
      <Navigation />
      <YTTHero />

      <div id="the-training" className={ANCHOR}>
        <YTTIntro />
      </div>

      <YTTDifferent />
      <YTTPathway />

      <div id="curriculum" className={ANCHOR}>
        <YTTCurriculum />
      </div>

      <YTTTestimonial />

      <YTTIncluded />
      <YTTRhythm />

      <div id="teachers" className={ANCHOR}>
        <YTTTeachers />
      </div>

      <YTTSanctuary />
      <YTTWhoFor />

      <div id="investment" className={ANCHOR}>
        <YTTPricing />
      </div>

      <YTTOutcomes />

      {/* Full-bleed transition band sits between the outcomes and the FAQ. */}
      <YTTClosingCTA />

      <div id="faq" className={ANCHOR}>
        <YTTFaq />
      </div>

      <Footer />
    </main>
    </PageMessages>
  );
}
