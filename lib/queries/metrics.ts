import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  isToday,
  subDays,
  isSameDay,
  isWithinInterval,
} from 'date-fns';
import { createServiceClient } from '@/lib/supabase/server';
import { costaRicaDateString, inCostaRica, nowInCostaRica } from '@/lib/costa-rica-time';

// ─── Row shapes (only the columns we read) ──────────────────────────────────
type ClassRow = {
  id: string;
  name: string;
  instructor_id: string | null;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  spots_remaining: number;
  price_dropin_usd: number;
  is_active: boolean;
  instructors: { id: string; name: string } | null;
};

type BookingRow = {
  id: string;
  class_id: string;
  email: string;
  persons: number;
  payment_status: 'pending' | 'confirmed' | 'cancelled' | 'no-show';
  total_usd: number | null;
  created_at: string;
};

type TemplateRow = {
  id: string;
  instructor_id: string | null;
  duration_minutes: number;
  capacity: number;
  price_dropin_usd: number;
  is_active: boolean;
  instructors: { id: string; name: string } | null;
};

export type DashboardMetrics = {
  bookingsToday: number;
  bookingsThisWeek: number;
  bookingsLastWeek: number;
  revenueThisMonth: number;
  classesNext7Days: number;
  avgOccupancy: number;
  uniqueStudents: number;
};

// Chart dates travel as Costa Rica calendar days (`YYYY-MM-DD`); the client
// formats them in the reader's language. `other` marks the "everything else"
// slice of the distribution, whose label is copy, not a class name.
export type ChartData = {
  dailyBookings: { date: string; reservas: number }[];
  weeklyRevenue: { semana: string; ingresos: number }[];
  classDistribution: { name: string; value: number; other?: boolean }[];
};

export type InstructorMetric = {
  id: string;
  /** Empty when the instructor has no name on record; the client labels it. */
  name: string;
  classesPerWeek: number;
  hoursPerWeek: number;
  avgParticipants: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
};

export type DashboardData = {
  metrics: DashboardMetrics;
  charts: ChartData;
  instructors: InstructorMetric[];
  upcoming: {
    id: string;
    name: string;
    instructor: string;
    startsAt: string;
    capacity: number;
    spotsRemaining: number;
  }[];
};

const MONDAY = { weekStartsOn: 1 } as const;

// Revenue counted for a booking (only confirmed ones generate revenue).
function bookingRevenue(b: BookingRow, cls: ClassRow | undefined): number {
  if (b.payment_status !== 'confirmed') return 0;
  if (b.total_usd != null) return Number(b.total_usd);
  return Number(cls?.price_dropin_usd ?? 0) * b.persons;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createServiceClient();
  // Today, this week and this month are Santa Teresa's.
  const now = nowInCostaRica();

  const [classesRes, bookingsRes, templatesRes] = await Promise.all([
    supabase
      .from('classes')
      .select(
        'id, name, instructor_id, starts_at, duration_minutes, capacity, spots_remaining, price_dropin_usd, is_active, instructors(id, name)',
      ),
    supabase
      .from('bookings')
      .select('id, class_id, email, persons, payment_status, total_usd, created_at'),
    supabase
      .from('class_templates')
      .select('id, instructor_id, duration_minutes, capacity, price_dropin_usd, is_active, instructors(id, name)'),
  ]);

  const classes = (classesRes.data ?? []) as unknown as ClassRow[];
  const bookings = (bookingsRes.data ?? []) as unknown as BookingRow[];
  const templates = (templatesRes.data ?? []) as unknown as TemplateRow[];

  const classById = new Map(classes.map((c) => [c.id, c]));
  const classDate = (b: BookingRow) => {
    const c = classById.get(b.class_id);
    return c ? inCostaRica(c.starts_at) : null;
  };

  // ─── Stat cards ───────────────────────────────────────────────────────────
  const thisWeekStart = startOfWeek(now, MONDAY);
  const thisWeekEnd = endOfWeek(now, MONDAY);
  const lastWeekStart = startOfWeek(subWeeks(now, 1), MONDAY);
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), MONDAY);
  const monthStart = startOfMonth(now);

  const bookingsToday = bookings.filter((b) => {
    const d = classDate(b);
    return d && isToday(d);
  }).length;

  const bookingsThisWeek = bookings.filter((b) => {
    const d = classDate(b);
    return d && isWithinInterval(d, { start: thisWeekStart, end: thisWeekEnd });
  }).length;

  const bookingsLastWeek = bookings.filter((b) => {
    const d = classDate(b);
    return d && isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd });
  }).length;

  const revenueThisMonth = bookings.reduce((acc, b) => {
    return acc + (b.created_at && inCostaRica(b.created_at) >= monthStart
      ? bookingRevenue(b, classById.get(b.class_id))
      : 0);
  }, 0);

  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingActive = classes.filter(
    (c) => c.is_active && inCostaRica(c.starts_at) >= now,
  );
  const classesNext7Days = upcomingActive.filter(
    (c) => inCostaRica(c.starts_at) <= in7,
  ).length;

  const avgOccupancy =
    upcomingActive.length > 0
      ? Math.round(
          (upcomingActive.reduce(
            (acc, c) => acc + (c.capacity - c.spots_remaining) / c.capacity,
            0,
          ) /
            upcomingActive.length) *
            100,
        )
      : 0;

  const uniqueStudents = new Set(
    bookings.filter((b) => b.payment_status !== 'cancelled').map((b) => b.email.toLowerCase()),
  ).size;

  // ─── Charts ───────────────────────────────────────────────────────────────
  const dailyBookings = Array.from({ length: 30 }, (_, i) => {
    const day = subDays(now, 29 - i);
    const reservas = bookings.filter((b) =>
      isSameDay(inCostaRica(b.created_at), day),
    ).length;
    return { date: costaRicaDateString(day), reservas };
  });

  const weeklyRevenue = Array.from({ length: 8 }, (_, i) => {
    const ref = subWeeks(now, 7 - i);
    const wStart = startOfWeek(ref, MONDAY);
    const wEnd = endOfWeek(ref, MONDAY);
    const ingresos = bookings.reduce((acc, b) => {
      const created = inCostaRica(b.created_at);
      return acc +
        (isWithinInterval(created, { start: wStart, end: wEnd })
          ? bookingRevenue(b, classById.get(b.class_id))
          : 0);
    }, 0);
    return { semana: costaRicaDateString(wStart), ingresos: Math.round(ingresos) };
  });

  // Class distribution — share of booked persons per class name.
  const personsByClass = new Map<string, number>();
  let totalPersons = 0;
  for (const b of bookings) {
    if (b.payment_status === 'cancelled') continue;
    const c = classById.get(b.class_id);
    if (!c) continue;
    personsByClass.set(c.name, (personsByClass.get(c.name) ?? 0) + b.persons);
    totalPersons += b.persons;
  }
  const sortedClasses = [...personsByClass.entries()].sort((a, b) => b[1] - a[1]);
  const topClasses = sortedClasses.slice(0, 5);
  const otherTotal = sortedClasses.slice(5).reduce((acc, [, v]) => acc + v, 0);
  const classDistribution =
    totalPersons > 0
      ? [
          ...topClasses.map(([name, v]) => ({
            name,
            value: Math.round((v / totalPersons) * 100),
          })),
          ...(otherTotal > 0
            ? [{ name: '', value: Math.round((otherTotal / totalPersons) * 100), other: true }]
            : []),
        ]
      : [];

  // ─── Per-instructor metrics ────────────────────────────────────────────────
  // classes/week + hours/week come from the recurring schedule (templates);
  // participants + revenue come from real booked instances.
  const instructorMap = new Map<string, InstructorMetric>();
  const ensure = (id: string, name: string): InstructorMetric => {
    let m = instructorMap.get(id);
    if (!m) {
      m = {
        id,
        name,
        classesPerWeek: 0,
        hoursPerWeek: 0,
        avgParticipants: 0,
        revenueThisWeek: 0,
        revenueThisMonth: 0,
      };
      instructorMap.set(id, m);
    }
    return m;
  };

  for (const t of templates) {
    if (!t.is_active || !t.instructor_id) continue;
    const m = ensure(t.instructor_id, t.instructors?.name ?? '');
    m.classesPerWeek += 1;
    m.hoursPerWeek += t.duration_minutes / 60;
  }

  // participants + revenue per instructor from class instances
  const personsByInstructor = new Map<string, number>();
  const instancesByInstructor = new Map<string, number>();
  for (const c of classes) {
    if (!c.instructor_id) continue;
    instancesByInstructor.set(
      c.instructor_id,
      (instancesByInstructor.get(c.instructor_id) ?? 0) + 1,
    );
  }
  for (const b of bookings) {
    const c = classById.get(b.class_id);
    if (!c?.instructor_id) continue;
    if (b.payment_status !== 'cancelled') {
      personsByInstructor.set(
        c.instructor_id,
        (personsByInstructor.get(c.instructor_id) ?? 0) + b.persons,
      );
    }
    const rev = bookingRevenue(b, c);
    if (rev > 0) {
      const created = inCostaRica(b.created_at);
      const m = ensure(c.instructor_id, c.instructors?.name ?? '');
      if (created >= monthStart) m.revenueThisMonth += rev;
      if (isWithinInterval(created, { start: thisWeekStart, end: thisWeekEnd }))
        m.revenueThisWeek += rev;
    }
  }

  for (const [id, m] of instructorMap) {
    const instances = instancesByInstructor.get(id) ?? 0;
    const persons = personsByInstructor.get(id) ?? 0;
    m.avgParticipants = instances > 0 ? Math.round((persons / instances) * 10) / 10 : 0;
    m.hoursPerWeek = Math.round(m.hoursPerWeek * 10) / 10;
    m.revenueThisWeek = Math.round(m.revenueThisWeek);
    m.revenueThisMonth = Math.round(m.revenueThisMonth);
  }

  const instructors = [...instructorMap.values()].sort(
    (a, b) => b.revenueThisMonth - a.revenueThisMonth || b.classesPerWeek - a.classesPerWeek,
  );

  // ─── Upcoming classes (next 5) ─────────────────────────────────────────────
  const upcoming = upcomingActive
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.name,
      instructor: c.instructors?.name ?? '',
      startsAt: c.starts_at,
      capacity: c.capacity,
      spotsRemaining: c.spots_remaining,
    }));

  return {
    metrics: {
      bookingsToday,
      bookingsThisWeek,
      bookingsLastWeek,
      revenueThisMonth: Math.round(revenueThisMonth),
      classesNext7Days,
      avgOccupancy,
      uniqueStudents,
    },
    charts: { dailyBookings, weeklyRevenue, classDistribution },
    instructors,
    upcoming,
  };
}
