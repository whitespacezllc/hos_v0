import { getClassTemplates } from '@/lib/queries/classes';
import { getInstructors } from '@/lib/queries/instructors';
import { getDropInPriceUsd } from '@/lib/queries/packs';
import { ensureUpcomingWeeks } from '@/app/actions/classes';
import ClasesClient from './_components/ClasesClient';
import type { ClassTemplate } from '@/types';

// Its actions can email everyone in a class, paced for the mail provider's limit.
export const maxDuration = 60;

export default async function AdminClasesPage() {
  // Materialize this/next week's sessions from the recurring schedule so the
  // calendar and public booking always have upcoming classes — replaces the old
  // manual "Regenerate week" button.
  await ensureUpcomingWeeks();

  const [templates, instructors, standardPriceUsd] = await Promise.all([
    getClassTemplates(),
    getInstructors(),
    getDropInPriceUsd(),
  ]);

  return (
    <ClasesClient
      initialTemplates={templates as unknown as ClassTemplate[]}
      instructors={instructors}
      standardPriceUsd={standardPriceUsd}
    />
  );
}
