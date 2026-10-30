'use client';

import { DaySchedule } from '@/components/shared/DaySchedule';
import { useMessages } from 'next-intl';

// Eleven frames following the day itself — practice, meals, study, the evening.
// Shot 2:3 (1000×1500), and framed at that ratio: forcing them into a 3:4 box
// would crop about a tenth of the height off every frame.
const FRAMES = Array.from(
  { length: 11 },
  (_, i) => `/images/schedule/schedule-${i + 1}.webp`,
);

// The schedule lives in the dictionary, in both languages; the section itself
// is the shared DaySchedule. No eyebrow and no footnote: the seven-day
// immersion runs Saturday to Friday, so the day reads as the rhythm of every
// day of it.
export function YTTRhythm() {
  const t = useMessages().ytt.rhythm;
  return (
    <DaySchedule
      heading={t.heading}
      blocks={t.blocks}
      trackAria={t.trackAria}
      frames={FRAMES}
    />
  );
}
