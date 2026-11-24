import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, CalendarDays, Package, TriangleAlert } from 'lucide-react';
import { apiClient } from '../api/client';
import { ApiErrorResponse } from '../types/auth';
import { PackageStatus } from '../types/dispatch';

type StatsResponse = {
  total: number;
  porEstado: Record<PackageStatus, number>;
  requierenRevision: number;
  entregadosPorDia: Array<{ fecha: string; total: number }>;
};

const statuses: Array<{ value: PackageStatus; label: string; color: string }> = [
  { value: 'REGISTRADO', label: 'Registrados', color: 'bg-slate-500' },
  { value: 'ASIGNADO', label: 'Asignados', color: 'bg-blue-600' },
  { value: 'EN_RUTA', label: 'En ruta', color: 'bg-amber-500' },
  { value: 'ENTREGADO', label: 'Entregados', color: 'bg-emerald-600' },
  { value: 'FALLIDO', label: 'Fallidos', color: 'bg-rose-600' },
];

export const StatsPage: React.FC = () => {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats', desde, hasta],
    queryFn: async () => {
      const params: { desde?: string; hasta?: string } = {};
      if (desde) params.desde = new Date(`${desde}T00:00:00.000Z`).toISOString();
      if (hasta) params.hasta = new Date(`${hasta}T23:59:59.999Z`).toISOString();
      const response = await apiClient.get<StatsResponse>('/stats', { params });
      return response.data;
    },
    retry: false,
  });

  const errorMessage = axios.isAxiosError<ApiErrorResponse>(error)
    ? error.response?.data.error.message ?? 'No se pudo conectar con el servicio de métricas.'
    : 'No se pudieron cargar las métricas. Inténtalo de nuevo.';
  const highestDailyCount = Math.max(1, ...(data?.entregadosPorDia.map((day) => day.total) ?? []));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/despacho" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Volver al despacho
          </Link>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Panel de administración</span>
        </header>

        <section className="mt-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Métricas de envíos</h1>
              <p className="mt-1 text-sm text-slate-600">Resumen operativo actualizado desde el servicio de estadísticas.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Desde
              <input
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(event) => setDesde(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Hasta
              <input
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(event) => setHasta(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <span className="inline-flex items-center gap-2 pb-2 text-xs text-slate-500">
              <CalendarDays className="h-4 w-4" />
              Filtro aplicado al consultar
            </span>
          </div>

          {isLoading && <div role="status" className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-600">Cargando métricas…</div>}
          {error && <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{errorMessage}</div>}

          {data && (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                    Total de paquetes <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{data.total}</p>
                </article>
                <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
                  <div className="flex items-center justify-between text-sm font-semibold text-amber-800">
                    Requieren revisión <TriangleAlert className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-4xl font-bold tracking-tight text-amber-900">{data.requierenRevision}</p>
                  <p className="mt-1 text-xs text-amber-800">Eventos marcados para validación administrativa</p>
                </article>
                <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-emerald-200 sm:col-span-2 lg:col-span-1">
                  <div className="text-sm font-semibold text-emerald-800">Entregas completadas</div>
                  <p className="mt-3 text-4xl font-bold tracking-tight text-emerald-900">{data.porEstado.ENTREGADO ?? 0}</p>
                  <p className="mt-1 text-xs text-slate-500">Paquetes con estado entregado</p>
                </article>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-lg font-bold text-slate-950">Paquetes por estado</h2>
                  <div className="mt-5 space-y-4">
                    {statuses.map((status) => {
                      const count = data.porEstado[status.value] ?? 0;
                      const percentage = data.total > 0 ? (count / data.total) * 100 : 0;
                      return (
                        <div key={status.value}>
                          <div className="mb-1.5 flex justify-between text-sm">
                            <span className="font-medium text-slate-700">{status.label}</span>
                            <span className="font-semibold tabular-nums text-slate-900">{count}</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${status.color}`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-lg font-bold text-slate-950">Entregas por día</h2>
                  {data.entregadosPorDia.length === 0 ? (
                    <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No hay entregas en el periodo seleccionado.</p>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {data.entregadosPorDia.map((day) => (
                        <div key={day.fecha} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm">
                          <time className="text-slate-600">
                            {new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${day.fecha}T00:00:00Z`))}
                          </time>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(day.total / highestDailyCount) * 100}%` }} />
                          </div>
                          <span className="text-right font-semibold tabular-nums text-slate-900">{day.total}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
};
