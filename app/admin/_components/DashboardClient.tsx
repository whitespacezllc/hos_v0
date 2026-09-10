'use client';

import { useMemo } from 'react';
import { inCostaRica, nowInCostaRica } from '@/lib/costa-rica-time';
import Link from 'next/link';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  CalendarDays,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  UserCheck,
  CalendarPlus,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/admin/Card';
import { Badge } from '@/components/admin/Badge';
import { Button } from '@/components/admin/Button';
import { EmptyState } from '@/components/admin/EmptyState';
import type { DashboardData } from '@/lib/queries/metrics';

// ─── Earth-tone palette (mirrors DESIGN_SYSTEM.md §2 Accents) ───────────────
const COLORS = {
  sage: '#6B7355',
  terracotta: '#8B6F47',
  burgundy: '#8D0000',
  sand: '#A6896D',
  warmGray: '#7A6B5D',
} as const;

const DONUT_COLORS = [
  COLORS.sage,
  COLORS.terracotta,
  COLORS.burgundy,
  COLORS.sand,
  COLORS.warmGray,
  'rgba(49,49,49,0.6)',
];

const AXIS_TICK = { fontSize: 11, fill: 'rgba(49,49,49,0.5)' } as const;
const GRID_STROKE = 'rgba(49,49,49,0.08)';
const TOOLTIP_STYLE: React.CSSProperties = {
  fontSize: 12,
  border: '1px solid rgba(49,49,49,0.1)',
  borderRadius: 0,
  background: '#ffffff',
  padding: '12px',
};

export default function DashboardClient({ data }: { data: DashboardData }) {
  const now = nowInCostaRica();
  const { metrics, charts, instructors, upcoming } = data;

  const pieDataView = useMemo(
    () =>
      charts.classDistribution.map((slice, i) => ({
        ...slice,
        color: DONUT_COLORS[i] ?? DONUT_COLORS[DONUT_COLORS.length - 1],
      })),
    [charts.classDistribution],
  );

  const todayEyebrow = format(now, 'EEEE, MMMM d, yyyy', { locale: enUS });

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-7xl mx-auto">
      <PageHeader eyebrow={todayEyebrow} heading="Dashboard" />

      {/* ─── Stats row ────────────────────────────────────────────────── */}
      <section
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10 lg:mb-12"
        aria-label="Key metrics"
      >
        <StatCard icon={Users} color={COLORS.sage} value={metrics.bookingsToday} label="Bookings today" />
        <StatCard
          icon={CalendarDays}
          color={COLORS.sage}
          value={metrics.bookingsThisWeek}
          label="This week"
          delta={metrics.bookingsThisWeek - metrics.bookingsLastWeek}
          deltaLabel="vs last week"
        />
        <StatCard icon={DollarSign} color={COLORS.terracotta} value={`$${metrics.revenueThisMonth}`} label="Revenue this month" />
        <StatCard icon={Clock} color={COLORS.sand} value={metrics.classesNext7Days} label="Classes (7 days)" />
        <StatCard icon={TrendingUp} color={COLORS.burgundy} value={`${metrics.avgOccupancy}%`} label="Avg. occupancy" />
        <StatCard icon={UserCheck} color={COLORS.warmGray} value={metrics.uniqueStudents} label="Unique students" />
      </section>

      {/* ─── Charts row — bar (2/3) + donut (1/3) ──────────────────────── */}
      <section
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 lg:mb-12"
        aria-label="Bookings and class distribution"
      >
        <Card className="lg:col-span-2">
          <ChartHeading title="Bookings per day" subtitle="Last 30 days" />
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.dailyBookings} barSize={6}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="date" tick={AXIS_TICK} interval={4} />
                <YAxis tick={AXIS_TICK} width={28} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(49,49,49,0.04)' }} />
                <Bar dataKey="reservas" fill={COLORS.sage} radius={0} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <ChartHeading title="Most popular classes" />
          {pieDataView.length === 0 ? (
            <p className="font-body text-sm text-ink/50 mt-6">No bookings yet.</p>
          ) : (
            <>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieDataView}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      dataKey="value"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {pieDataView.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: number) => [`${val}%`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-6 space-y-3">
                {pieDataView.map((d) => (
                  <li key={d.name} className="flex justify-between items-center gap-3">
                    <span className="flex items-center gap-3 min-w-0">
                      <span aria-hidden className="w-2 h-2 flex-shrink-0" style={{ background: d.color }} />
                      <span className="font-body text-sm text-ink/80 truncate">{d.name}</span>
                    </span>
                    <span className="font-body text-sm font-medium text-ink">{d.value}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </section>

      {/* ─── Revenue per week (full width) ──────────────────────────────── */}
      <section className="mb-10 lg:mb-12" aria-label="Revenue trend">
        <Card>
          <ChartHeading title="Revenue per week" subtitle="Last 8 weeks" />
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={charts.weeklyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="semana" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} width={44} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: number) => [`$${val}`, 'Revenue']} />
                <Line
                  type="monotone"
                  dataKey="ingresos"
                  stroke={COLORS.terracotta}
                  strokeWidth={2}
                  dot={{ r: 4, fill: COLORS.terracotta, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* ─── Instructor performance ─────────────────────────────────────── */}
      <section className="mb-10 lg:mb-12" aria-label="Instructor performance">
        <header className="mb-6">
          <h2 className="font-body text-base font-medium text-ink">Instructor performance</h2>
          <p className="font-body text-xs text-ink/50 mt-1">
            Weekly load from the recurring schedule · participants &amp; revenue from real bookings
          </p>
        </header>

        {instructors.length === 0 ? (
          <EmptyState
            icon={<UserCheck strokeWidth={1} />}
            heading="No instructor data yet"
            description="Assign instructors to your recurring classes to see their metrics here."
            action={
              <Link href="/admin/clases">
                <Button variant="primary">Go to Classes</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue bar chart */}
            <Card className="lg:col-span-1">
              <ChartHeading title="Revenue this month" subtitle="By instructor" />
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={Math.max(160, instructors.length * 44)}>
                  <BarChart data={instructors} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                    <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={90} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: number) => [`$${val}`, 'Revenue']} />
                    <Bar dataKey="revenueThisMonth" fill={COLORS.terracotta} radius={0} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Metrics table */}
            <Card className="lg:col-span-2" padding="tight">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-ink/10">
                      {['Instructor', 'Classes / wk', 'Hours / wk', 'Avg. attendees', '$ / week', '$ / month'].map(
                        (h, i) => (
                          <th
                            key={h}
                            className={`px-3 py-2.5 font-body text-[10px] tracking-[0.15em] uppercase font-medium text-ink/50 ${i === 0 ? 'text-left' : 'text-right'}`}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {instructors.map((m) => (
                      <tr key={m.id} className="border-b border-ink/[0.08] last:border-0">
                        <td className="px-3 py-3 font-body text-sm font-medium text-ink">{m.name}</td>
                        <td className="px-3 py-3 font-body text-sm text-ink/80 text-right">{m.classesPerWeek}</td>
                        <td className="px-3 py-3 font-body text-sm text-ink/80 text-right">{m.hoursPerWeek}</td>
                        <td className="px-3 py-3 font-body text-sm text-ink/80 text-right">{m.avgParticipants}</td>
                        <td className="px-3 py-3 font-body text-sm text-ink/80 text-right">${m.revenueThisWeek}</td>
                        <td className="px-3 py-3 font-body text-sm font-medium text-ink text-right">${m.revenueThisMonth}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </section>

      {/* ─── Upcoming classes ───────────────────────────────────────────── */}
      <section aria-label="Upcoming classes">
        <header className="flex justify-between items-end mb-6">
          <h2 className="font-body text-base font-medium text-ink">Upcoming classes</h2>
          <Link
            href="/admin/calendario"
            className="font-body text-sm text-ink underline underline-offset-4 decoration-[0.5px] hover:opacity-70 transition-opacity duration-200"
          >
            View calendar →
          </Link>
        </header>

        {upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarPlus strokeWidth={1} />}
            heading="No upcoming classes"
            description="Create a recurring class to populate the schedule."
            action={
              <Link href="/admin/clases">
                <Button variant="primary">Go to Classes</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((c) => (
              <UpcomingClassRow key={c.id} clase={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────
type StatCardProps = {
  icon: LucideIcon;
  color: string;
  value: string | number;
  label: string;
  delta?: number;
  deltaLabel?: string;
};

function StatCard({ icon: Icon, color, value, label, delta, deltaLabel }: StatCardProps) {
  const deltaSign = delta === undefined ? null : delta > 0 ? '+' : delta < 0 ? '' : '+';
  const deltaColorClass =
    delta === undefined ? '' : delta > 0 ? 'text-[#6B7355]' : delta < 0 ? 'text-[#8B6F47]' : 'text-ink/40';

  return (
    <Card padding="tight" className="hover:border-ink/20 transition-colors duration-200">
      <div aria-hidden className="w-8 h-8 flex items-center justify-center" style={{ background: `${color}1A` }}>
        <Icon width={16} height={16} strokeWidth={1.5} style={{ color }} />
      </div>
      <p className="font-body text-3xl font-light text-ink leading-none mt-4">{value}</p>
      <p className="font-body text-xs text-ink/60 mt-1">{label}</p>
      {delta !== undefined && deltaLabel && (
        <p className={`font-body text-xs font-medium mt-2 ${deltaColorClass}`}>
          {deltaSign}
          {delta} {deltaLabel}
        </p>
      )}
    </Card>
  );
}

// ─── Chart heading ──────────────────────────────────────────────────────────
function ChartHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="font-body text-base font-medium text-ink leading-tight">{title}</h2>
      {subtitle && <p className="font-body text-xs text-ink/50 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Upcoming class row ─────────────────────────────────────────────────────
type UpcomingClass = DashboardData['upcoming'][number];

function UpcomingClassRow({ clase }: { clase: UpcomingClass }) {
  const startsAt = inCostaRica(clase.startsAt);
  const booked = clase.capacity - clase.spotsRemaining;
  const remaining = clase.spotsRemaining;
  const remainingPct = clase.capacity > 0 ? remaining / clase.capacity : 0;

  const statusVariant: 'active' | 'warning' | 'destructive' =
    remaining === 0 ? 'destructive' : remainingPct < 0.5 ? 'warning' : 'active';
  const statusLabel = remaining === 0 ? 'Full' : remainingPct < 0.5 ? 'Low' : 'Open';

  return (
    <Card padding="tight" className="hover:border-ink/20 transition-colors duration-200">
      <div className="grid grid-cols-12 gap-4 items-center">
        <div className="col-span-3 md:col-span-1">
          <p className="font-body text-[10px] tracking-[0.15em] uppercase text-ink/50">
            {format(startsAt, 'EEE', { locale: enUS })}
          </p>
          <p className="font-body text-xl font-light text-ink leading-none mt-0.5">
            {format(startsAt, 'd', { locale: enUS })}
          </p>
        </div>
        <div className="col-span-3 md:col-span-1">
          <p className="font-body text-sm text-ink">{format(startsAt, 'HH:mm')}</p>
        </div>
        <div className="col-span-6 md:col-span-4 min-w-0">
          <p className="font-body text-sm font-medium text-ink truncate">{clase.name}</p>
        </div>
        <div className="col-span-6 md:col-span-2 min-w-0">
          {clase.instructor ? (
            <p className="font-body text-sm text-ink/70 truncate">{clase.instructor}</p>
          ) : (
            <p className="font-body text-sm text-ink/30">—</p>
          )}
        </div>
        <div className="col-span-3 md:col-span-2">
          <p className="font-body text-sm text-ink">
            {booked} / {clase.capacity}
          </p>
        </div>
        <div className="col-span-3 md:col-span-2 flex md:justify-end">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
      </div>
    </Card>
  );
}
