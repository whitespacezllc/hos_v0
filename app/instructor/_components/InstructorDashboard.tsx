'use client';

import { useMemo } from 'react';
import { inCostaRica, nowInCostaRica } from '@/lib/costa-rica-time';
import { format, isThisWeek, isToday, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarDays, Users, DollarSign, TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { YogaClass } from '@/types';

const SAGE  = '#4a7c59';
const TERRA = '#c4622d';

type SerializedClass = Omit<YogaClass, 'startsAt'> & { startsAt: string };

interface BookingRow {
  id: string;
  class_id: string;
  first_name: string;
  last_name: string;
  email: string;
  persons: number;
  payment_status: string;
  booking_reference: string;
  total_usd: number | null;
  created_at: string;
}

interface Props {
  instructor: { id: string; name: string; email: string };
  classes: SerializedClass[];
  bookings: BookingRow[];
}

export default function InstructorDashboard({ instructor, classes, bookings }: Props) {
  const now = nowInCostaRica();

  const clases: YogaClass[] = classes.map(c => ({ ...c, startsAt: inCostaRica(c.startsAt) }));

  const metrics = useMemo(() => {
    const totalBookings = bookings.length;

    const bookingsThisWeek = bookings.filter(b => {
      const clase = clases.find(c => c.id === b.class_id);
      return clase && isThisWeek(clase.startsAt, { weekStartsOn: 1 });
    }).length;

    const totalPersonas = bookings.reduce((acc, b) => acc + (b.persons ?? 1), 0);

    const ingresos = bookings
      .filter(b => b.payment_status === 'confirmed' || b.payment_status === 'pending')
      .reduce((acc, b) => {
        const clase = clases.find(c => c.id === b.class_id);
        return acc + (clase?.priceUsd ?? 0) * (b.persons ?? 1);
      }, 0);

    const clasesActivas = clases.filter(c => c.isActive && isFuture(c.startsAt));
    const ocupacion = clasesActivas.length > 0
      ? Math.round(
          clasesActivas.reduce(
            (acc, c) => acc + (c.capacity - c.spotsRemaining) / c.capacity,
            0
          ) / clasesActivas.length * 100
        )
      : 0;

    return { totalBookings, bookingsThisWeek, totalPersonas, ingresos, ocupacion };
  }, [clases, bookings]);

  const proximasClases = useMemo(
    () => clases
      .filter(c => c.isActive && isFuture(c.startsAt))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, 8),
    [clases]
  );

  const ultimasReservas = useMemo(
    () => bookings.slice(0, 10),
    [bookings]
  );

  function statusLabel(status: string) {
    const map: Record<string, { label: string; cls: string }> = {
      confirmed: { label: 'Confirmada',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      pending:   { label: 'Pendiente',    cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
      cancelled: { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-500 border-gray-200' },
      'no-show': { label: 'No se presentó', cls: 'bg-red-50 text-red-600 border-red-200' },
    };
    return map[status] ?? map.pending;
  }

  return (
    <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Hola, {instructor.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-0.5 capitalize">
          {format(now, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* Métricas personales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={<Users className="w-4 h-4" />}
          label="Total reservas"
          value={metrics.totalBookings}
          color={SAGE}
        />
        <MetricCard
          icon={<CalendarDays className="w-4 h-4" />}
          label="Esta semana"
          value={metrics.bookingsThisWeek}
          color={SAGE}
        />
        <MetricCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Ingresos generados"
          value={`$${metrics.ingresos}`}
          color={TERRA}
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Ocupación prom."
          value={`${metrics.ocupacion}%`}
          color={TERRA}
        />
      </div>

      {/* Próximas clases */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Mis próximas clases</h2>
        {proximasClases.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-slate-400 text-sm">
            No tenés clases programadas próximamente.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Clase</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Reservas</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Precio</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody>
                {proximasClases.map(clase => {
                  const reservas = bookings.filter(b => b.class_id === clase.id).length;
                  const llena = clase.spotsRemaining === 0;
                  const esHoy = isToday(clase.startsAt);
                  return (
                    <tr key={clase.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className={`text-xs font-medium capitalize ${esHoy ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {esHoy ? '🔴 Hoy' : format(clase.startsAt, "EEE d MMM", { locale: es })}
                        </p>
                        <p className="text-xs text-slate-400">{format(clase.startsAt, "HH:mm")} · {clase.durationMinutes} min</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: clase.color ?? SAGE }} />
                          <span className="font-medium text-slate-800">{clase.name}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{clase.location}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold text-sm ${llena ? 'text-red-500' : 'text-slate-700'}`}>
                          {clase.capacity - clase.spotsRemaining}/{clase.capacity}
                        </span>
                        <div className="mt-1 h-1 w-16 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, ((clase.capacity - clase.spotsRemaining) / clase.capacity) * 100)}%`,
                              backgroundColor: llena ? '#ef4444' : SAGE,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                        {clase.priceUsd === 0 ? 'Gratis' : `$${clase.priceUsd}`}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            llena
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {llena ? 'Llena' : 'Disponible'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Últimas reservas */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Últimas reservas</h2>
        {ultimasReservas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-slate-400 text-sm">
            Aún no hay reservas en tus clases.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Alumno</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Clase</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Personas</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Fecha reserva</th>
                </tr>
              </thead>
              <tbody>
                {ultimasReservas.map(b => {
                  const clase = clases.find(c => c.id === b.class_id);
                  const s = statusLabel(b.payment_status);
                  return (
                    <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{b.first_name} {b.last_name}</p>
                        <p className="text-xs text-slate-400 truncate">{b.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                        {clase ? (
                          <div>
                            <p className="font-medium text-slate-700">{clase.name}</p>
                            <p className="text-xs text-slate-400">{format(clase.startsAt, "d MMM · HH:mm", { locale: es })}</p>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{b.persons}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${s.cls}`}>
                          {s.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 hidden sm:table-cell">
                        {format(inCostaRica(b.created_at), "d MMM yyyy", { locale: es })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

function MetricCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="w-7 h-7 rounded-md flex items-center justify-center mb-2 text-white" style={{ background: color }}>
        {icon}
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
