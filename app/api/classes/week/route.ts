import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureWeekMaterialized } from '@/lib/queries/classes';
import type { DbClass } from '@/types';
import { dbClassToYogaClass } from '@/types';
import { COSTA_RICA_OFFSET } from '@/lib/costa-rica-time';
import { releaseStaleCardHolds } from '@/lib/checkout/core';

// Always run fresh: the endpoint materializes the week's occurrences and must
// reflect the live schedule (no static/route caching).
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }

    // `start` and `end` are Costa Rica calendar days; a class at 20:00 on the
    // Sunday is still that Sunday's class, not Monday 02:00 UTC's.
    const startDate = new Date(`${start}T00:00:00${COSTA_RICA_OFFSET}`);
    const endDate = new Date(`${end}T23:59:59.999${COSTA_RICA_OFFSET}`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'invalid_dates' }, { status: 400 });
    }

    // Auto-create the week's occurrences from the recurring schedule before
    // reading; the spots of abandoned card checkouts are released after the
    // response has gone out.
    await ensureWeekMaterialized(startDate);
    // `sweep=1` forces the throttled sweep — for tests, never in production.
    const force = process.env.NODE_ENV !== 'production' && searchParams.get('sweep') === '1';
    after(() => releaseStaleCardHolds(force));

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('classes')
      .select('*, instructors(id, name)')
      .eq('is_active', true)
      .gte('starts_at', startDate.toISOString())
      .lte('starts_at', endDate.toISOString())
      .order('starts_at', { ascending: true });

    if (error) {
      console.error('[GET /api/classes/week]', error.message);
      return NextResponse.json({ classes: [] });
    }

    const classes = (data as unknown as DbClass[]).map(dbClassToYogaClass).map((c) => ({
      ...c,
      startsAt: c.startsAt.toISOString(),
    }));

    return NextResponse.json({ classes });
  } catch (err) {
    console.error('[GET /api/classes/week]', err);
    return NextResponse.json({ classes: [] });
  }
}
