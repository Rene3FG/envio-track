import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  X,
  Plus,
  Pencil,
  MapPin,
  AlertTriangle,
  Crosshair,
  Save
} from 'lucide-react';
import { DriverItem, PackageRecord } from '../types/dispatch';

export interface OaxacaZonePreset {
  nombre: string;
  lat: number;
  lng: number;
}

export const OAXACA_ZONES: OaxacaZonePreset[] = [
  { nombre: 'Oaxaca Centro', lat: 17.0609, lng: -96.7255 },
  { nombre: 'Colonia Reforma', lat: 17.0782, lng: -96.7135 },
  { nombre: 'Barrio de Jalatlaco', lat: 17.0668, lng: -96.7140 },
  { nombre: 'San Felipe del Agua', lat: 17.0950, lng: -96.7050 },
  { nombre: 'Candiani / Universidad', lat: 17.0420, lng: -96.7160 },
  { nombre: 'Santa Cruz Xoxocotlán', lat: 17.0270, lng: -96.7350 },
  { nombre: 'Santa María del Tule', lat: 17.0460, lng: -96.6350 },
];

export interface PackageFormValues {
  destinatario: string;
  telefonoDestinatario: string;
  direccion: string;
  zona: string;
  referencias: string;
  lat: number;
  lng: number;
  urgente: boolean;
  driverId: string;
}

interface DriverLoadSummary {
  current: number;
  percentage: number;
  available: number;
  isFull: boolean;
  isNearFull: boolean;
}

interface PackageFormModalProps {
  mode: 'create' | 'edit';
  initialPackage?: PackageRecord | null;
  drivers: DriverItem[];
  getDriverLoad: (driverId: string, maxCapacity: number) => DriverLoadSummary;
  onClose: () => void;
  onSubmit: (values: PackageFormValues) => Promise<void> | void;
}

function findNearestOaxacaZone(lat: number, lng: number): string {
  let closest = OAXACA_ZONES[0];
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const zone of OAXACA_ZONES) {
    const dLat = zone.lat - lat;
    const dLng = zone.lng - lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      closest = zone;
    }
  }

  return closest.nombre;
}

function createPinIcon(urgente: boolean): L.DivIcon {
  const color = urgente ? '#EF4444' : '#3B82F6';
  return L.divIcon({
    className: 'package-picker-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);pointer-events:auto;cursor:grab;">
        <div style="width:28px;height:28px;border-radius:9999px;background:${color};border:2.5px solid #FFFFFF;box-shadow:0 4px 12px rgba(0,0,0,0.6),0 0 12px ${color};display:flex;align-items:center;justify-content:center;color:#FFF;font-size:13px;">
          📦
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};margin-top:-1px;"></div>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

export const PackageFormModal: React.FC<PackageFormModalProps> = ({
  mode,
  initialPackage,
  drivers,
  getDriverLoad,
  onClose,
  onSubmit,
}) => {
  const isEdit = mode === 'edit' && Boolean(initialPackage);

  const [destinatario, setDestinatario] = useState(initialPackage?.destinatario ?? '');
  const [telefonoDestinatario, setTelefonoDestinatario] = useState(initialPackage?.telefonoDestinatario ?? '');
  const [direccion, setDireccion] = useState(initialPackage?.direccion ?? '');
  const [zona, setZona] = useState(initialPackage?.zona ?? 'Oaxaca Centro');
  const [referencias, setReferencias] = useState(initialPackage?.referencias ?? initialPackage?.notas ?? '');
  const [lat, setLat] = useState<number>(initialPackage?.lat ?? 17.0609);
  const [lng, setLng] = useState<number>(initialPackage?.lng ?? -96.7255);
  const [urgente, setUrgente] = useState<boolean>(initialPackage?.urgente ?? false);
  const [driverId, setDriverId] = useState<string>(initialPackage?.repartidor?.id ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Referencias del mini mapa Leaflet
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Inicializar mini mapa de Oaxaca al abrir el modal
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri World Imagery',
          maxZoom: 18,
        }
      ).addTo(map);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '',
          maxZoom: 18,
        }
      ).addTo(map);

      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: createPinIcon(urgente),
      }).addTo(map);

      const applyPoint = (nextLat: number, nextLng: number) => {
        const roundedLat = Number(nextLat.toFixed(5));
        const roundedLng = Number(nextLng.toFixed(5));
        setLat(roundedLat);
        setLng(roundedLng);
        setZona(findNearestOaxacaZone(roundedLat, roundedLng));
      };

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        applyPoint(pos.lat, pos.lng);
      });

      map.on('click', (ev: L.LeafletMouseEvent) => {
        marker.setLatLng(ev.latlng);
        applyPoint(ev.latlng.lat, ev.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      map.invalidateSize();
    }, 60);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // Solo al montar/desmontar el modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizar posición e ícono del marcador cuando cambian lat/lng/urgente desde inputs o presets
  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      markerRef.current.setLatLng([lat, lng]);
      markerRef.current.setIcon(createPinIcon(urgente));
    }
  }, [lat, lng, urgente]);

  const handleSelectZonePreset = (preset: OaxacaZonePreset) => {
    setZona(preset.nombre);
    setLat(preset.lat);
    setLng(preset.lng);
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([preset.lat, preset.lng]);
      mapRef.current.flyTo([preset.lat, preset.lng], 15, { duration: 0.4 });
    }
  };

  const handleCenterOnPin = () => {
    if (mapRef.current && Number.isFinite(lat) && Number.isFinite(lng)) {
      mapRef.current.flyTo([lat, lng], 15, { duration: 0.35 });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedDestinatario = destinatario.trim();
    const trimmedDireccion = direccion.trim();

    if (trimmedDestinatario.length < 2) {
      setValidationError('El nombre del destinatario debe tener al menos 2 caracteres.');
      return;
    }

    if (trimmedDireccion.length < 3) {
      setValidationError('La dirección debe tener al menos 3 caracteres.');
      return;
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setValidationError('La latitud debe ser un número válido entre -90 y 90.');
      return;
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setValidationError('La longitud debe ser un número válido entre -180 y 180.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        destinatario: trimmedDestinatario,
        telefonoDestinatario: telefonoDestinatario.trim(),
        direccion: trimmedDireccion,
        zona: zona.trim() || findNearestOaxacaZone(lat, lng),
        referencias: referencias.trim(),
        lat,
        lng,
        urgente,
        driverId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeDrivers = drivers.filter((d) => d.activo);
  const selectedDriver = drivers.find((d) => d.id === driverId);
  const selectedDriverLoad = selectedDriver
    ? getDriverLoad(selectedDriver.id, selectedDriver.capacidadMaxima)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0B111E] border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Cabecera del Modal */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0B111E] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isEdit ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
            }`}>
              {isEdit ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>{isEdit ? `Editar Paquete — ${initialPackage?.guia}` : 'Alta de Nuevo Paquete'}</span>
                {isEdit && initialPackage && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {initialPackage.estado}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEdit
                  ? 'Actualiza los datos de destino, referencias, urgencia o punto exacto en el mapa.'
                  : 'Registra el envío y selecciona el punto de entrega en Oaxaca.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido en 2 columnas: Formulario + Selector de Mapa */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs font-mono">
            
            {/* Columna Izquierda: Datos del Envío */}
            <div className="lg:col-span-6 space-y-4">
              {validationError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1">Nombre Completo del Destinatario *</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={destinatario}
                  onChange={(e) => setDestinatario(e.target.value)}
                  placeholder="Lic. Frida Cosijoeza Mendoza"
                  className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Teléfono Destinatario</label>
                  <input
                    type="tel"
                    value={telefonoDestinatario}
                    onChange={(e) => setTelefonoDestinatario(e.target.value)}
                    placeholder="+52 951 516 4020"
                    className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Zona / Sector</label>
                  <input
                    type="text"
                    value={zona}
                    onChange={(e) => setZona(e.target.value)}
                    placeholder="Oaxaca Centro"
                    className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Dirección Completa *</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Av. Benito Juárez #302, Oaxaca Centro..."
                  className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Referencias de Entrega</label>
                <input
                  type="text"
                  value={referencias}
                  onChange={(e) => setReferencias(e.target.value)}
                  placeholder="Portón blanco, entregar en recepción..."
                  className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {!isEdit && (
                <div>
                  <label className="block text-slate-300 mb-1">Chofer Asignado (Opcional)</label>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white cursor-pointer"
                  >
                    <option value="" className="bg-[#0B111E]">
                      Sin asignar (dejar en bodega como REGISTRADO)
                    </option>
                    {activeDrivers.map((d) => {
                      const dLoad = getDriverLoad(d.id, d.capacidadMaxima);
                      return (
                        <option key={d.id} value={d.id} className="bg-[#0B111E]">
                          {d.nombre} — {d.unidad} [{dLoad.current}/{d.capacidadMaxima} • {dLoad.isFull ? '⛔ LLENO' : `🟢 ${dLoad.available} libres`}]
                        </option>
                      );
                    })}
                  </select>
                  {selectedDriver && selectedDriverLoad?.isFull && (
                    <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        Aviso: {selectedDriver.nombre} ya alcanzó su capacidad máxima ({selectedDriverLoad.current}/{selectedDriver.capacidadMaxima}).
                      </span>
                    </p>
                  )}
                </div>
              )}

              <label className="p-3 bg-[#0F172A] border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-700 transition">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span>⚡ Marcar envío como URGENTE</span>
                </span>
                <input
                  type="checkbox"
                  checked={urgente}
                  onChange={(e) => setUrgente(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Columna Derecha: Selector de Ubicación en Mapa de Oaxaca */}
            <div className="lg:col-span-6 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <span>Ubicación de Entrega</span>
                </span>
                <button
                  type="button"
                  onClick={handleCenterOnPin}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] flex items-center gap-1 whitespace-nowrap shrink-0 transition"
                  title="Centrar mapa en el pin actual"
                >
                  <Crosshair className="w-3 h-3 text-blue-400" />
                  <span>Centrar pin</span>
                </button>
              </div>

              {/* Zonas rápidas de Oaxaca */}
              <div className="flex flex-wrap gap-1.5">
                {OAXACA_ZONES.map((preset) => {
                  const isActive = zona === preset.nombre;
                  return (
                    <button
                      key={preset.nombre}
                      type="button"
                      onClick={() => handleSelectZonePreset(preset)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-[#070B14] text-slate-300 border-slate-700 hover:border-blue-500/60 hover:text-white'
                      }`}
                    >
                      {preset.nombre}
                    </button>
                  );
                })}
              </div>

              {/* Contenedor Mini Mapa Leaflet */}
              <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-700 bg-[#070B14] relative">
                <div ref={mapContainerRef} className="w-full h-full z-10" />
              </div>

              {/* Coordenadas sincronizadas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">Latitud *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value))}
                    className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">Longitud *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value))}
                    className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Botones de Acción */}
          <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 ${
                isEdit
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {isEdit ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>
                {isSubmitting
                  ? 'Guardando...'
                  : isEdit
                    ? 'Guardar Cambios'
                    : 'Crear Guía'}
              </span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
