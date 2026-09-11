'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Navigation } from '@/components/landing/navigation';
import { Footer } from '@/components/landing/footer';
import { CloudbedsImmersive } from '@/components/booking-engine/CloudbedsImmersive';

// The page is a heading and the engine. No hero: a reader who clicked
// "Reserve" has decided, and the footage would only stand between them and
// the calendar. The heading is the contact page's — centred, mount-animated,
// generous above — so the two utility pages open the same way.
//
// No `overflow-hidden` on <main>, unlike the editorial pages: the engine keeps
// a sticky bar (the cart, on phones), and an overflow-clipped ancestor is what
// breaks `position: sticky`. Its modals and popovers portal to <body> and are
// unaffected either way.
export default function BookPageClient() {
  const t = useTranslations('book');

  return (
    <main id="main-content" className="bg-warm-white">
      <Navigation />

      <section className="pt-24 lg:pt-32 pb-10 lg:pb-14">
        <div className="w-[90%] md:w-[80%] mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
            className="font-display font-light text-ink text-4xl md:text-5xl lg:text-6xl leading-[1.1]"
          >
            {t('heading')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.25 }}
            className="font-body text-sm md:text-base text-ink/80 leading-[1.7] mt-5 max-w-xl mx-auto"
          >
            {t('intro')}
          </motion.p>
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <CloudbedsImmersive />
      </section>

      <Footer />
    </main>
  );
}
