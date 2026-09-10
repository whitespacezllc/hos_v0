'use client';

import { AboutChapter } from '@/components/about/AboutChapter';
import { Ornament } from '@/components/shared/ornament';
import { useMessages } from 'next-intl';

// Nancy first, then the house — the order the words were written in: the
// house "was born from the same vision", and the vision is hers.
//
// Two photographs on the whole page, one per chapter. The founder's portrait
// is the one the training landing already uses for her; the house is the
// frame the home's own introduction opens on.
const PHOTO_NANCY = '/images/teachers/nancy.webp';
const PHOTO_HOUSE = '/images/home/introduction/home-introduction-01.webp';

export function AboutChapters() {
  const t = useMessages().about;

  return (
    <>
      <AboutChapter copy={t.nancy} photo={PHOTO_NANCY} photoSide="left" />

      {/* The moon cycle between the two chapters — the home's own breath
          between sections, one step below the marks that seal a heading. */}
      <div className="bg-warm-white flex justify-center">
        <Ornament src="/logos/moon-phase.png" className="h-9 md:h-[42px]" />
      </div>

      <AboutChapter copy={t.house} photo={PHOTO_HOUSE} photoSide="right" />
    </>
  );
}
