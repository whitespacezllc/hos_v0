import { getClassById } from '@/lib/queries/classes';
import { getActiveUpsells } from '@/lib/queries/upsells';
import { getSellablePacks } from '@/lib/queries/packs';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { localeFromParams } from '@/i18n/routing';
import { PageMessages } from '@/i18n/PageMessages';
import BookingFlow from './BookingFlow';

export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string; classId: string }>;
}) {
  const [locale, { classId }] = await Promise.all([localeFromParams(params), params]);
  setRequestLocale(locale);
  const [clase, upsells, packs] = await Promise.all([
    getClassById(classId),
    getActiveUpsells(),
    getSellablePacks(),
  ]);

  if (!clase) notFound();

  // `yoga` too: the class category labels are the schedule's.
  return (
    <PageMessages namespaces={['booking', 'yoga']}>
    <BookingFlow
      classId={classId}
      className={clase.name}
      instructor={clase.instructors?.name ?? ''}
      startsAt={clase.starts_at}
      durationMinutes={clase.duration_minutes}
      capacity={clase.capacity}
      spotsRemaining={clase.spots_remaining}
      priceUsd={Number(clase.price_dropin_usd)}
      location={clase.location}
      description={clase.description ?? ''}
      color={clase.color ?? undefined}
      imageUrl={clase.image_url ?? undefined}
      upsells={upsells}
      packs={packs}
      locale={locale}
    />
    </PageMessages>
  );
}
