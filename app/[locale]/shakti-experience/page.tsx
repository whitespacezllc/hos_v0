import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import { FaqJsonLd } from '@/components/seo/JsonLd';
import { Navigation } from '@/components/landing/navigation';
import { Footer } from '@/components/landing/footer';
import { ShaktiHero } from '@/components/shakti-experience/ShaktiHero';
import { ShaktiIntro } from '@/components/shakti-experience/ShaktiIntro';
import { ShaktiMoreThanAStay } from '@/components/shakti-experience/ShaktiMoreThanAStay';
import { ShaktiReview } from '@/components/shakti-experience/ShaktiReview';
import { ShaktiForYou } from '@/components/shakti-experience/ShaktiForYou';
import { ShaktiPricing } from '@/components/shakti-experience/ShaktiPricing';
import { ShaktiDay } from '@/components/shakti-experience/ShaktiDay';
import { ShaktiPlace } from '@/components/shakti-experience/ShaktiPlace';
import { ShaktiClosingCTA } from '@/components/shakti-experience/ShaktiClosingCTA';
import { ShaktiFaq } from '@/components/shakti-experience/ShaktiFaq';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: 'shaktiExperience.meta' });
  return buildMetadata({
    path: '/shakti-experience',
    title: t('title'),
    description: t('description'),
    locale,
  });
}

// ─── Shakti Experience ───────────────────────────────────────────────────────
// A packaged stay — or one designed around the guest — rather than a guided
// retreat. Every section is one the site already speaks: the training
// landing's hero, testimonial, audience, day, sanctuary, closing band and
// questions; the home's opening arrangement; Stay With Us's activities
// track. The pricing is the one section of its own, in the training's
// pricing language.
export default async function ShaktiExperiencePage({ params }: LocaleParams) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <PageMessages namespaces={['shaktiExperience']}>
      <FaqJsonLd items={messages.shaktiExperience.faq.items.map((i) => ({ question: i.q, answer: i.a }))} />
    <main id="main-content" className="bg-warm-white overflow-hidden">
      <Navigation />
      <ShaktiHero />
      <ShaktiIntro />
      <ShaktiMoreThanAStay />
      <ShaktiReview />
      <ShaktiForYou />
      <ShaktiPricing />
      <ShaktiDay />
      <ShaktiPlace />
      {/* Full-bleed transition band sits between the house and the questions,
          as on the training landing. */}
      <ShaktiClosingCTA />
      <ShaktiFaq />
      <Footer />
    </main>
    </PageMessages>
  );
}
