'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BUSINESS } from '@/lib/business';
import { SHALA_POLICY_ITEMS } from '@/lib/shala-policy';

// The policy, set as a plain document: each point's name on the left and what
// it says on the right, with nothing to get in the way of reading it.
export function ShalaPolicy() {
  const t = useTranslations('shalaPolicy');

  return (
    <section className="bg-warm-white pt-32 lg:pt-44 pb-20 lg:pb-28">
      <div className="w-[90%] md:w-[80%] max-w-5xl mx-auto">
        <h1 className="font-display font-light text-ink text-4xl md:text-5xl leading-tight">
          {t('title')}
        </h1>
        <p className="font-body text-base text-ink/70 mt-4">{t('subtitle')}</p>

        <dl className="mt-12 lg:mt-16 border-t border-ink/10">
          {SHALA_POLICY_ITEMS.map((key) => (
            <div
              key={key}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 md:gap-10 py-6 lg:py-8 border-b border-ink/10"
            >
              <dt className="font-display font-light text-ink text-xl leading-snug">
                {t(`items.${key}.term`)}
              </dt>
              <dd className="font-body text-base text-ink leading-relaxed">
                {t(`items.${key}.text`)}
              </dd>
            </div>
          ))}
        </dl>

        <p className="font-body text-base text-ink leading-relaxed mt-10 lg:mt-12">
          {t('contact')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mt-6">
          <a
            href={BUSINESS.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300"
          >
            {t('whatsapp')}
          </a>
          <Link
            href="/yoga"
            className="font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-300"
          >
            {t('schedule')}
          </Link>
        </div>
      </div>
    </section>
  );
}
