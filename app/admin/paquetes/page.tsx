import { getAllPackPurchases, getPriceList } from '@/lib/queries/packs';
import PaquetesAdminClient from './_components/PaquetesAdminClient';

export default async function AdminPaquetesPage() {
  const [purchases, priceList] = await Promise.all([getAllPackPurchases(), getPriceList()]);
  return <PaquetesAdminClient purchases={purchases} priceList={priceList} />;
}
