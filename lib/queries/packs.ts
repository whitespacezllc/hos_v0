import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export type ClassPack = {
  id: string;
  name: string;
  classesCount: number;
  priceUsd: number;
};

export type PackPurchase = {
  id: string;
  packId: string | null;
  packName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  code: string | null;
  classesTotal: number;
  classesUsed: number;
  status: 'pending' | 'paid' | 'cancelled';
  amountUsd: number | null;
  createdAt: string;
  paidAt: string | null;
};

// Public: the multi-class packs offered for sale (excludes the single drop-in).
export async function getSellablePacks(): Promise<ClassPack[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('class_packs')
      .select('id, name, classes_count, price_usd')
      .eq('is_active', true)
      .gt('classes_count', 1)
      .order('classes_count', { ascending: true });
    if (error) {
      console.error('[getSellablePacks]', error.message);
      return [];
    }
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      classesCount: p.classes_count,
      priceUsd: Number(p.price_usd),
    }));
  } catch (err) {
    console.error('[getSellablePacks] unexpected:', err);
    return [];
  }
}

type PurchaseRow = {
  id: string;
  pack_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  code: string | null;
  classes_total: number;
  classes_used: number;
  status: string;
  amount_usd: number | null;
  created_at: string;
  paid_at: string | null;
  class_packs: { name: string } | null;
};

export async function getAllPackPurchases(): Promise<PackPurchase[]> {
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('pack_purchases')
      .select('*, class_packs(name)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[getAllPackPurchases]', error.message);
      return [];
    }
    return (data as unknown as PurchaseRow[]).map((p) => ({
      id: p.id,
      packId: p.pack_id,
      packName: p.class_packs?.name ?? `Pack x${p.classes_total}`,
      firstName: p.first_name,
      lastName: p.last_name,
      email: p.email,
      phone: p.phone,
      code: p.code,
      classesTotal: p.classes_total,
      classesUsed: p.classes_used,
      status: p.status as PackPurchase['status'],
      amountUsd: p.amount_usd != null ? Number(p.amount_usd) : null,
      createdAt: p.created_at,
      paidAt: p.paid_at,
    }));
  } catch (err) {
    console.error('[getAllPackPurchases] unexpected:', err);
    return [];
  }
}

// ─── The price list ──────────────────────────────────────────────────────────
// What the panel's price editor shows: the catalogue's rows still on sale. The
// row with one class is the drop-in, the standard price of a single class. It
// isn't sold as a pack: each class carries its own price (a free meditation, a
// special workshop), and the drop-in is the one most of them share, which is
// what `updatePrices` keeps in step.
export type PriceRow = {
  id: string;
  name: string;
  classesCount: number;
  priceUsd: number;
};

export type SpecialPriceClass = { name: string; priceUsd: number };

export type PriceList = {
  /** Null only if the catalogue has lost its drop-in row. */
  dropIn: PriceRow | null;
  /** The packs on sale, smallest first. */
  packs: PriceRow[];
  /** Active recurring classes priced apart from the drop-in: a save won't touch them. */
  specialClasses: SpecialPriceClass[];
};

const toPriceRow = (r: { id: string; name: string; classes_count: number; price_usd: number | string }): PriceRow => ({
  id: r.id,
  name: r.name,
  classesCount: r.classes_count,
  priceUsd: Number(r.price_usd),
});

export async function getPriceList(): Promise<PriceList> {
  const supabase = createServiceRoleClient();
  const [{ data: rows, error }, { data: templates, error: templatesError }] = await Promise.all([
    supabase
      .from('class_packs')
      .select('id, name, classes_count, price_usd')
      .eq('is_active', true)
      .order('classes_count', { ascending: true }),
    supabase.from('class_templates').select('name, price_dropin_usd').eq('is_active', true),
  ]);
  if (error) console.error('[getPriceList]', error.message);
  if (templatesError) console.error('[getPriceList] templates', templatesError.message);

  const all = (rows ?? []).map(toPriceRow);
  const dropIn = all.find((r) => r.classesCount === 1) ?? null;
  const special = new Map<string, SpecialPriceClass>();
  if (dropIn) {
    for (const t of templates ?? []) {
      const priceUsd = Number(t.price_dropin_usd);
      if (priceUsd !== dropIn.priceUsd) special.set(`${t.name}|${priceUsd}`, { name: t.name, priceUsd });
    }
  }
  return {
    dropIn,
    packs: all.filter((r) => r.classesCount > 1),
    specialClasses: [...special.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Used until the catalogue answers, so a new class never starts from nothing. */
const FALLBACK_DROP_IN_USD = 25;

/** The standard price of one class: where a new class's price starts from. */
export async function getDropInPriceUsd(): Promise<number> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('class_packs')
    .select('price_usd')
    .eq('classes_count', 1)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) console.error('[getDropInPriceUsd]', error.message);
  return data ? Number(data.price_usd) : FALLBACK_DROP_IN_USD;
}
