import { getAllRetreatListings } from '@/lib/queries/retreatListings';
import { todayInCostaRica } from '@/lib/retreat-listings';
import RetreatsClient from './_components/RetreatsClient';

// "Today" is decided here, on the server and in Costa Rica's clock, so the
// panel and the public page draw the upcoming/past line in the same place
// whatever timezone the admin is reading from.
export default async function AdminRetreatsPage() {
  const listings = await getAllRetreatListings();
  return <RetreatsClient listings={listings ?? []} loadFailed={listings === null} today={todayInCostaRica()} />;
}
