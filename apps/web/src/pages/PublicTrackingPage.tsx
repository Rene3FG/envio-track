import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Image,
  MapPin,
  Package,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { ApiErrorResponse } from '../types/auth';
import { PackageStatus } from '../types/dispatch';

type TrackingEvent = {
  tipo: 'CREADO' | 'ASIGNADO' | 'EN_RUTA' | 'ENTREGADO' | 'INTENTO_FALLIDO';
  ocurridoEn: string;
  lat: number | null;
  lng: number | null;
  fotoUrl: string | null;
  motivo: string | null;
};

type PublicTracking = {
  guia: string;
  estado: PackageStatus;
  destinatario: string;
  eventos: TrackingEvent[];
};

const statusLabels: Record<PackageStatus, string> = {
  REGISTRADO: 'Registrado',
  ASIGNADO: 'Asignado a reparto',
  EN_RUTA: 'En camino',
  ENTREGADO: 'Entregado',
  FALLIDO: 'Entrega no completada',
};

const eventLabels: Record<TrackingEvent['tipo'], string> = {
  CREADO: 'Paquete recibido',
  ASIGNADO: 'Asignado a reparto',
  EN_RUTA: 'En camino',
  ENTREGADO: 'Entrega realizada',
  INTENTO_FALLIDO: 'Intento de entrega',
};

const formatDate = (value: string, timeZone = 'America/Mexico_City') =>
  new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));

export const PublicTrackingPage: React.FC = () => {
  const { guia } = useParams<{ guia: string }>();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(guia ?? '');
  const [selectedEvidence, setSelectedEvidence] = useState<TrackingEvent | null>(null);

  useEffect(() => {
    setSearchValue(guia ?? '');
  }, [guia]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-tracking', guia],
    queryFn: async () => {
      const response = await apiClient.get<PublicTracking>(
        `/track/${encodeURIComponent(guia!.trim().toUpperCase())}`,
      );
      return response.data;
    },
    enabled: Boolean(guia?.trim()),
    retry: false,
  });

  const errorMessage = axios.isAxiosError<ApiErrorResponse>(error)
    ? error.response?.data.error.message ?? 'No se pudo conectar con el servicio de rastreo.'
    : 'No se pudo cargar el rastreo. Inténtalo de nuevo.';

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedGuide = searchValue.trim().toUpperCase();
    if (normalizedGuide) {
      navigate(`/tracking/${encodeURIComponent(normalizedGuide)}`);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Inicio
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Rastreo público
          </span>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-9">
          <div className="mb-7">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Package className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">EnvíoTrack</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Rastrea tu envío
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Consulta el estado y el historial de tu paquete con el número de guía. No necesitas iniciar sesión.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="tracking-guide" className="sr-only">Número de guía</label>
            <input
              id="tracking-guide"
              type="text"
              required
              autoComplete="off"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value.toUpperCase())}
              placeholder="Ej. ET-104920"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm uppercase outline-none transition placeholder:normal-case placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
            <button
              type="submit"
              disabled={!searchValue.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              Consultar guía
            </button>
          </form>

          {!guia && (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <Search className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-3 font-semibold text-slate-800">Escribe tu número de guía para comenzar</p>
              <p className="mt-1 text-sm text-slate-500">El historial de rastreo aparecerá aquí.</p>
            </div>
          )}

          {isLoading && (
            <div role="status" className="mt-8 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-600">
              Buscando el envío…
            </div>
          )}

          {error && (
            <div role="alert" className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              {errorMessage}
            </div>
          )}

          {data && (
            <div className="mt-8">
              <div className="rounded-2xl bg-slate-950 p-5 text-white sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Guía {data.guia}</p>
                  <p className="mt-1 text-lg font-semibold">{data.destinatario}</p>
                </div>
                <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-semibold text-emerald-300 sm:mt-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {statusLabels[data.estado]}
                </span>
              </div>

              <div className="mt-8">
                <h2 className="text-lg font-bold text-slate-950">Historial del envío</h2>
                {data.eventos.length === 0 ? (
                  <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    Aún no hay eventos disponibles para esta guía.
                  </p>
                ) : (
                  <ol className="mt-5 space-y-0">
                    {data.eventos.map((item, index) => {
                      const hasLocation = item.lat !== null && item.lng !== null;
                      const hasEvidence = Boolean(item.fotoUrl || hasLocation);
                      const isLatest = index === data.eventos.length - 1;
                      return (
                        <li key={`${item.tipo}-${item.ocurridoEn}-${index}`} className="relative flex gap-4 pb-7 last:pb-0">
                          {index < data.eventos.length - 1 && (
                            <span className="absolute left-[15px] top-8 h-full w-px bg-slate-200" aria-hidden="true" />
                          )}
                          <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${isLatest ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {item.tipo === 'ENTREGADO' ? <CheckCircle2 className="h-4 w-4" /> : item.tipo === 'EN_RUTA' ? <Truck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0 flex-1 pt-1">
                            <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start">
                              <h3 className="font-semibold text-slate-900">{eventLabels[item.tipo]}</h3>
                              <time className="text-xs text-slate-500">{formatDate(item.ocurridoEn)}</time>
                            </div>
                            {item.motivo && <p className="mt-1 text-sm text-slate-600">{item.motivo}</p>}
                            {hasEvidence && (
                              <button
                                type="button"
                                onClick={() => setSelectedEvidence(item)}
                                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                              >
                                <Image className="h-4 w-4 text-emerald-700" />
                                Ver evidencia de entrega
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          )}
        </section>

        <p className="mt-5 text-center text-xs text-slate-500">
          Solo se muestran datos de seguimiento necesarios para consultar tu envío.
        </p>
      </div>

      {selectedEvidence && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEvidence(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="evidence-title" className="font-bold text-slate-950">Evidencia de entrega</h2>
                <p className="mt-0.5 text-xs text-slate-500">Información registrada por el dispositivo del repartidor</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar evidencia"
                onClick={() => setSelectedEvidence(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-5">
              {selectedEvidence.fotoUrl ? (
                <img
                  src={selectedEvidence.fotoUrl}
                  alt="Fotografía de evidencia de la entrega"
                  className="max-h-[55vh] w-full rounded-xl bg-slate-100 object-contain"
                />
              ) : (
                <div className="flex min-h-40 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
                  No se adjuntó fotografía para este evento.
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    Hora registrada
                  </div>
                  <p className="mt-2 font-semibold text-slate-900">{formatDate(selectedEvidence.ocurridoEn)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    UTC: {formatDate(selectedEvidence.ocurridoEn, 'UTC')}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <MapPin className="h-4 w-4" />
                    Ubicación GPS
                  </div>
                  {selectedEvidence.lat !== null && selectedEvidence.lng !== null ? (
                    <>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-900">
                        {selectedEvidence.lat.toFixed(5)}, {selectedEvidence.lng.toFixed(5)}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${selectedEvidence.lat},${selectedEvidence.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                      >
                        Abrir mapa <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No hay coordenadas disponibles.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
