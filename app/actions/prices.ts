'use server';

import { revalidatePath } from 'next/cache';
import { isAdminSession } from '@/lib/auth/require-admin';
import type { ActionResult } from '@/lib/schedule/sessions';
import { createServiceRoleClient } from '@/lib/supabase/service';

// ─── Prices ──────────────────────────────────────────────────────────────────
// The studio's own control over what the website charges. Everything that reads
// a price reads it from the database at the moment it's needed: /paquetes, the
// booking flow and the server-side checkout read `class_packs`, and a class's
// price is on its own row. What has been bought is never touched: a booking and
// a pack purchase each store the amount they were sold at.
export type PriceUpdate = { id: string; priceUsd: number };

export type UpdatePricesResult = ActionResult<{
  /** Upcoming sessions now charging the new drop-in. */
  sessionsUpdated: number;
}>;

const NOT_ADMIN = { ok: false, error: 'not_admin' } as const;
const SAVE_FAILED = { ok: false, error: 'save_failed' } as const;
const MAX_PRICE_USD = 100_000;

export async function updatePrices(updates: PriceUpdate[]): Promise<UpdatePricesResult> {
  if (!(await isAdminSession())) return NOT_ADMIN;

  // Whatever the form let through, a price is a positive amount in cents. Zero
  // is refused: a free pack would hand out codes without a payment, and a free
  // drop-in would make every class free.
  const wanted = new Map<string, number>();
  for (const { id, priceUsd } of updates) {
    if (typeof id !== 'string' || !Number.isFinite(priceUsd) || priceUsd <= 0 || priceUsd > MAX_PRICE_USD) {
      return SAVE_FAILED;
    }
    wanted.set(id, Math.round(priceUsd * 100) / 100);
  }
  if (wanted.size === 0) return { ok: true, sessionsUpdated: 0 };

  const supabase = createServiceRoleClient();
  const { data: rows, error } = await supabase
    .from('class_packs')
    .select('id, classes_count, price_usd')
    .in('id', [...wanted.keys()]);
  if (error || !rows || rows.length !== wanted.size) {
    console.error('[updatePrices] read', error?.message);
    return SAVE_FAILED;
  }

  let sessionsUpdated = 0;
  for (const row of rows) {
    const oldPrice = Number(row.price_usd);
    const newPrice = wanted.get(row.id)!;
    if (newPrice === oldPrice) continue;

    // The drop-in: the recurring classes and the upcoming sessions charging the
    // old standard price move with it, and a class priced on its own keeps its
    // price. The row itself is written last, so a failure halfway is put right
    // by saving again: the old price still names who has yet to move.
    if (row.classes_count === 1) {
      const { error: templatesError } = await supabase
        .from('class_templates')
        .update({ price_dropin_usd: newPrice })
        .eq('price_dropin_usd', oldPrice);
      if (templatesError) {
        console.error('[updatePrices] templates', templatesError.message);
        return SAVE_FAILED;
      }
      const { data: sessions, error: sessionsError } = await supabase
        .from('classes')
        .update({ price_dropin_usd: newPrice })
        .eq('price_dropin_usd', oldPrice)
        .gte('starts_at', new Date().toISOString())
        .select('id');
      if (sessionsError) {
        console.error('[updatePrices] sessions', sessionsError.message);
        return SAVE_FAILED;
      }
      sessionsUpdated = sessions?.length ?? 0;
    }

    const { error: rowError } = await supabase.from('class_packs').update({ price_usd: newPrice }).eq('id', row.id);
    if (rowError) {
      console.error('[updatePrices] row', rowError.message);
      return SAVE_FAILED;
    }
  }

  revalidatePath('/admin', 'layout');
  revalidatePath('/[locale]/yoga', 'page');
  revalidatePath('/[locale]/paquetes', 'page');
  revalidatePath('/[locale]/booking/[classId]', 'page');
  return { ok: true, sessionsUpdated };
}
