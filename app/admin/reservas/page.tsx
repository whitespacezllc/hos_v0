import { getAllBookings } from '@/lib/queries/bookings';
import { getAllClasses } from '@/lib/queries/classes';
import { getActiveUpsells, getAllUpsells } from '@/lib/queries/upsells';
import ReservasClient from './_components/ReservasClient';
import type { Booking, YogaClass } from '@/types';

export default async function AdminReservasPage() {
  const [bookings, classes, upsells, activeUpsells] = await Promise.all([
    getAllBookings(),
    getAllClasses(),
    getAllUpsells(),
    getActiveUpsells(),
  ]);

  const serializedBookings = bookings.map(b => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
  })) as (Omit<Booking, 'createdAt'> & { createdAt: string })[];

  const classMap = Object.fromEntries(
    classes.map(c => [c.id, {
      id: c.id,
      name: c.name,
      startsAt: c.startsAt.toISOString(),
      color: (c as YogaClass & { color?: string }).color ?? null,
      priceUsd: c.priceUsd,
    }]),
  );

  const upsellMap = Object.fromEntries(
    upsells.map(u => [u.id, { id: u.id, name: u.name, priceUsd: u.priceUsd }]),
  );

  return (
    <ReservasClient
      initialBookings={serializedBookings}
      classMap={classMap}
      upsellMap={upsellMap}
      pickableClasses={classes
        .filter((c) => c.isActive)
        .map((c) => ({
          id: c.id,
          name: c.name,
          startsAt: c.startsAt.toISOString(),
          instructor: c.instructor,
          spotsRemaining: c.spotsRemaining,
          priceUsd: c.priceUsd,
        }))}
      upsellOptions={activeUpsells.map((u) => ({ id: u.id, name: u.name, priceUsd: u.priceUsd }))}
    />
  );
}
