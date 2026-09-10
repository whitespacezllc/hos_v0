import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { localeFromParams, type LocaleParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import { Navigation } from "@/components/landing/navigation";
import { Hero } from "@/components/landing/hero";
// Introduction ("We are not in the business of more.") removed from home — file preserved
// import { Introduction } from "@/components/landing/introduction";
import { Pillars } from "@/components/landing/pillars";
import { ReturnToYourself } from "@/components/landing/return-to-yourself";
import { SeasonalExperiences } from "@/components/landing/seasonal-experiences";
import { Gallery } from "@/components/landing/gallery";
// TODO: Testimonials section removed from home — file preserved
// import { Testimonials } from "@/components/landing/testimonials";
import { HostYourRetreat } from "@/components/landing/HostYourRetreat";
import { QuoteBreak } from "@/components/landing/QuoteBreak";
import { Ornament } from "@/components/shared/ornament";
import { Footer } from "@/components/landing/footer";
import { SiteJsonLd } from "@/components/seo/JsonLd";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: 'home.meta' });
  return buildMetadata({
    path: '/',
    title: t('title'),
    description: t('description'),
    absoluteTitle: true,
    locale,
  });
}

export default async function Home({ params }: LocaleParams) {
  const locale = await localeFromParams(params);
  setRequestLocale(locale);
  const t = await getTranslations('home.testimonial');

  return (
    <PageMessages namespaces={['home']}>
    <main id="main-content" className="overflow-hidden">
      {/* LodgingBusiness + WebSite, rendered once for the whole site. Every
          other schema references the business by @id rather than repeating it. */}
      <SiteJsonLd />
      <Navigation />
      <Hero />
      {/* Brand statement + scattered photos, right below the hero video */}
      <ReturnToYourself />
      <Pillars />
      {/* Guest testimonial — the full-height treatment built for the YTT
          landing: the photograph carries the section, the words sit centred in
          it. Scrim strength is measured against this specific image (see
          QuoteBreak); re-measure if the photograph is swapped. */}
      <QuoteBreak
        variant="testimonial"
        image="/images/home/quote/quote-img.webp"
        quote={t('quote')}
        author={t('author')}
        role={t('role')}
      />
      <SeasonalExperiences />
      <HostYourRetreat />
      {/* Rhythm mark — a quiet breath between sections. The moon cycle, which is
          the mark this beat was always meant to carry; `dots-rhythm.png` is a
          row of flat black dots and read as a stray element rather than as the
          phases. Sized one step below the ornaments that seal a heading, so it
          reads as punctuation and not as the start of a new section.
          No opacity class here: Ornament animates opacity with framer-motion,
          which writes `opacity: 1` inline and beats any utility set on it. */}
      <div className="bg-warm-white flex justify-center">
        <Ornament src="/logos/moon-phase.png" className="h-9 md:h-[42px]" />
      </div>
      <Gallery />
      {/* <Testimonials /> — removed from render, kept in repo */}
      <Footer />
    </main>
    </PageMessages>
  );
}
