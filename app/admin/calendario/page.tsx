import { getAllClasses, getInstructors } from '@/lib/queries/classes';
import { getAllBookings } from '@/lib/queries/bookings';
import { getActiveUpsells } from '@/lib/queries/upsells';
import { getDropInPriceUsd } from '@/lib/queries/packs';
import { ensureUpcomingWeeks } from '@/app/actions/classes';
import CalendarioClient from './_components/CalendarioClient';
import type { YogaClass, Booking } from '@/types';

// Its actions can email everyone in a class, paced for the mail provider's limit.
export const maxDuration = 60;

export default async function AdminCalendarioPage() {
  // Materialize the recurring schedule for the next ~3 months.
  await ensureUpcomingWeeks();

  const [classes, bookings, instructors, upsells, standardPriceUsd] = await Promise.all([
    getAllClasses(),
    getAllBookings(),
    getInstructors(),
    getActiveUpsells(),
    getDropInPriceUsd(),
  ]);

  const serializedClasses = classes.map(c => ({
    ...c,
    startsAt: c.startsAt.toISOString(),
  })) as (Omit<YogaClass, 'startsAt'> & { startsAt: string })[];

  const serializedBookings = bookings.map(b => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
  })) as (Omit<Booking, 'createdAt'> & { createdAt: string })[];

  const upsellOptions = upsells.map((u) => ({
    id: u.id,
    name: u.name,
    priceUsd: u.priceUsd,
  }));

  return (
    <CalendarioClient
      initialClasses={serializedClasses}
      initialBookings={serializedBookings}
      instructors={instructors}
      upsells={upsellOptions}
      standardPriceUsd={standardPriceUsd}
    />
  );
}
