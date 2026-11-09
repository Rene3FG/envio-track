import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import L from 'leaflet';
import { PackageRecord, DriverItem } from '../types/dispatch';
import {
  Truck,
  Package,
  AlertTriangle,
  Plus,
  Search,
  LogOut,
  X,
  MapPin,
  User,
  ShieldCheck,
  Navigation,
  Eye,
  BarChart3,
  Users,
  Compass,
  Camera
} from 'lucide-react';

// ==========================================
// Datos Iniciales (Basados en la propuesta de René)
// ==========================================
const MOCK_DRIVERS_LIST: DriverItem[] = [
  { id: 'drv-ana', nombre: 'Ana Martínez', unidad: 'Van Eléctrica #01', tipo: 'EV', telefono: '+52 55 4123 9901', activo: true, paquetesAsignados: 3, bateria: 94, zona: 'Zona Rosa / Cuauhtémoc' },
  { id: 'drv-carlos', nombre: 'Carlos Gómez', unidad: 'Motocicleta Ágil #03', tipo: 'MOTO', telefono: '+52 55 9911 2244', activo: true, paquetesAsignados: 1, bateria: 88, zona: 'Polanco / Chapultepec' },
  { id: 'drv-roberto', nombre: 'Roberto Sánchez', unidad: 'Camioneta Isuzu #02', tipo: 'CAMION', telefono: '+52 55 6677 8899', activo: true, paquetesAsignados: 1, bateria: 78, zona: 'Coyoacán Sur' },
  { id: 'drv-david', nombre: 'David Morales', unidad: 'Van Transit #04', tipo: 'VAN', telefono: '+52 55 5544 3322', activo: false, paquetesAsignados: 0, bateria: 0, zona: 'En Descanso' },
];

export type MapThemeKey = 'calles' | 'satelite' | 'osm' | 'dark';

export const MAP_THEMES: Record<MapThemeKey, { name: string; url: string; attribution: string; maxZoom: number }> = {
  calles: {
    name: 'Calles a Color (Estilo Google Maps)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Street Map',
    maxZoom: 19
  },
  satelite: {
    name: 'Satélite HD',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
    maxZoom: 18
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  },
  dark: {
    name: 'Modo Gris / Nocturno',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri Dark Canvas',
    maxZoom: 18
  }
};

export interface ActiveVehicle {
  id: string;
  driverId: string;
  driverName: string;
  unit: string;
  type: 'EV' | 'MOTO' | 'CAMION';
  icon: string;
  lat: number;
  lng: number;
  battery: number;
  speed: string;
  heading: string;
  color: string;
  zona: string;
  paquetesAsignados: number;
}

export const ACTIVE_FLEET_VEHICLES: ActiveVehicle[] = [
  {
    id: 'veh-ana',
    driverId: 'drv-ana',
    driverName: 'Ana Martínez',
    unit: 'Van Eléctrica #01',
    type: 'EV',
    icon: '🚐',
    lat: 19.4245,
    lng: -99.1660,
    battery: 94,
    speed: '36 km/h',
    heading: 'NE Reforma',
    color: '#00F5A0',
    zona: 'Zona Rosa / Cuauhtémoc',
    paquetesAsignados: 3,
  },
  {
    id: 'veh-carlos',
    driverId: 'drv-carlos',
    driverName: 'Carlos Gómez',
    unit: 'Moto Ágil #03',
    type: 'MOTO',
    icon: '🏍️',
    lat: 19.4340,
    lng: -99.1915,
    battery: 88,
    speed: '44 km/h',
    heading: 'NW Polanco',
    color: '#FF5E00',
    zona: 'Polanco / Chapultepec',
    paquetesAsignados: 1,
  },
  {
    id: 'veh-roberto',
    driverId: 'drv-roberto',
    driverName: 'Roberto Sánchez',
    unit: 'Camión Isuzu #02',
    type: 'CAMION',
    icon: '🚚',
    lat: 19.3490,
    lng: -99.1625,
    battery: 78,
    speed: '28 km/h',
    heading: 'SE Coyoacán',
    color: '#38BDF8',
    zona: 'Coyoacán Sur',
    paquetesAsignados: 1,
  },
];

const INITIAL_PACKAGES_RENE: PackageRecord[] = [
  {
    id: 'pkg-104920',
    guia: 'ET-104920',
    destinatario: 'Juan Pérez García',
    telefonoDestinatario: '+52 55 4123 9901',
    direccion: 'Av. Paseo de la Reforma 222, Piso 8, Of. 804',
    zona: 'Zona Rosa / Cuauhtémoc',
    lat: 19.4270,
    lng: -99.1677,
    urgente: true,
    estado: 'EN_RUTA',
    repartidor: { id: 'drv-ana', nombre: 'Ana Martínez', unidad: 'Van Eléctrica #01' },
    requiereRevision: false,
    creadoEn: '2026-11-06T06:00:00Z',
    actualizadoEn: '2026-11-06T08:30:00Z',
    eta: '14:15 CST (12 min)',
    progreso: 75,
    notas: 'Entregar en recepción con sello de acuse.',
    eventos: [
      { tipo: 'CREADO', ocurridoEn: '6 nov 2026, 6:00 a. m.', detalle: 'Paquete recibido en centro logístico' },
      { tipo: 'ASIGNADO', ocurridoEn: '6 nov 2026, 7:15 a. m.', detalle: 'Asignado a Ana Martínez' },
      { tipo: 'EN_RUTA', ocurridoEn: '6 nov 2026, 8:30 a. m.', detalle: 'En camino a destino con ruta 2-opt' }
    ]
  },
  {
    id: 'pkg-104921',
    guia: 'ET-104921',
    destinatario: 'María Rodríguez Lara',
    telefonoDestinatario: '+52 55 8821 7733',
    direccion: 'Calle Colima 145, Depto 302, Col. Roma Norte',
    zona: 'Condesa / Roma',
    lat: 19.4195,
    lng: -99.1610,
    urgente: false,
    estado: 'ENTREGADO',
    repartidor: { id: 'drv-ana', nombre: 'Ana Martínez', unidad: 'Van Eléctrica #01' },
    requiereRevision: false,
    creadoEn: '2026-11-06T01:30:00Z',
    actualizadoEn: '2026-11-06T04:48:00Z',
    eta: 'Entregado 04:48 a.m.',
    progreso: 100,
    notas: 'Firma digitalizada de entrega.',
    eventos: [
      { tipo: 'CREADO', ocurridoEn: '6 nov 2026, 1:30 a. m.', detalle: 'Paquete recibido en centro logístico' },
      { tipo: 'ASIGNADO', ocurridoEn: '6 nov 2026, 2:10 a. m.', detalle: 'Asignado a Ana Martínez' },
      { tipo: 'EN_RUTA', ocurridoEn: '6 nov 2026, 3:15 a. m.', detalle: 'En camino a destino' },
      { tipo: 'ENTREGADO', ocurridoEn: '6 nov 2026, 4:48 a. m.', detalle: 'Entregado en mano a María R. Firma digitalizada y evidencia fotográfica.', firma: true, foto: true }
    ]
  },
  {
    id: 'pkg-104922',
    guia: 'ET-104922',
    destinatario: 'Esteban Castro Mendoza',
    telefonoDestinatario: '+52 55 9911 2244',
    direccion: 'Av. Horacio 620, Depto 501, Polanco',
    zona: 'Polanco / Chapultepec',
    lat: 19.4332,
    lng: -99.1910,
    urgente: true,
    estado: 'FALLIDO',
    repartidor: { id: 'drv-carlos', nombre: 'Carlos Gómez', unidad: 'Motocicleta Ágil #03' },
    requiereRevision: true,
    creadoEn: '2026-11-06T06:30:00Z',
    actualizadoEn: '2026-11-06T09:40:00Z',
    eta: 'Reprogramar Turno',
    progreso: 20,
    notas: 'Nadie en domicilio. Timbre descompuesto.',
    eventos: [
      { tipo: 'CREADO', ocurridoEn: '6 nov 2026, 6:30 a. m.', detalle: 'Paquete recibido en centro logístico' },
      { tipo: 'ASIGNADO', ocurridoEn: '6 nov 2026, 7:20 a. m.', detalle: 'Asignado a Carlos Gómez' },
      { tipo: 'EN_RUTA', ocurridoEn: '6 nov 2026, 8:15 a. m.', detalle: 'En camino a destino' },
      { tipo: 'FALLIDO', ocurridoEn: '6 nov 2026, 9:40 a. m.', detalle: 'Intento fallido: Nadie en domicilio / timbre no funciona', motivo: 'Nadie en casa' }
    ]
  },
  {
    id: 'pkg-104923',
    guia: 'ET-104923',
    destinatario: 'Lucía Fernández Ramos',
    telefonoDestinatario: '+52 55 6677 8899',
    direccion: 'Calle Francisco Sosa 89, Coyoacán Centro',
    zona: 'Coyoacán Sur',
    lat: 19.3490,
    lng: -99.1620,
    urgente: false,
    estado: 'ASIGNADO',
    repartidor: { id: 'drv-roberto', nombre: 'Roberto Sánchez', unidad: 'Camioneta Isuzu #02' },
    requiereRevision: false,
    creadoEn: '2026-11-06T07:10:00Z',
    actualizadoEn: '2026-11-06T08:00:00Z',
    eta: '16:00 CST',
    progreso: 35,
    notas: 'Casa con zaguán negro de herrería.',
    eventos: [
      { tipo: 'CREADO', ocurridoEn: '6 nov 2026, 7:10 a. m.', detalle: 'Paquete recibido en centro logístico' },
      { tipo: 'ASIGNADO', ocurridoEn: '6 nov 2026, 8:00 a. m.', detalle: 'Asignado a Roberto Sánchez' }
    ]
  },
  {
    id: 'pkg-104924',
    guia: 'ET-104924',
    destinatario: 'Daniel Ortega Valle',
    telefonoDestinatario: '+52 55 2233 4455',
    direccion: 'Eje Central Lázaro Cárdenas 13, Despacho 401',
    zona: 'Centro Histórico',
    lat: 19.4340,
    lng: -99.1415,
    urgente: true,
    estado: 'REGISTRADO',
    repartidor: null,
    requiereRevision: false,
    creadoEn: '2026-11-06T08:30:00Z',
    actualizadoEn: '2026-11-06T08:30:00Z',
    eta: 'Pendiente Chofer',
    progreso: 10,
    notas: 'Horario de oficina hasta las 18:00.',
    eventos: [
      { tipo: 'CREADO', ocurridoEn: '6 nov 2026, 8:30 a. m.', detalle: 'Paquete registrado y recibido en bodega' }
    ]
  },
  {
    id: 'pkg-104925',
    guia: 'ET-104925',
    destinatario: 'Patricia Morales Solis',
    telefonoDestinatario: '+52 55 5544 3322',
    direccion: 'Av. División del Norte 1240, Col. Del Valle',
    zona: 'Del Valle / Narvarte',
    lat: 19.3820,
    lng: -99.1605,
    urgente: false,
    estado: 'EN_RUTA',
    repartidor: { id: 'drv-ana', nombre: 'Ana Martínez', unidad: 'Van Eléctrica #01' },
    requiereRevision: false,
    creadoEn: '2026-11-06T06:50:00Z',
    actualizadoEn: '2026-11-06T08:45:00Z',
    eta: '14:45 CST (28 min)',
    progreso: 65,
    notas: 'Dejar con portero del edificio si no responden.',
    eventos: [
      { tipo: 'CREADO', ocurridoEn: '6 nov 2026, 6:50 a. m.', detalle: 'Paquete recibido en centro logístico' },
      { tipo: 'ASIGNADO', ocurridoEn: '6 nov 2026, 7:30 a. m.', detalle: 'Asignado a Ana Martínez' },
      { tipo: 'EN_RUTA', ocurridoEn: '6 nov 2026, 8:45 a. m.', detalle: 'En camino a destino' }
    ]
  },
  {
    id: 'pkg-104926',
    guia: 'ET-104926',
    destinatario: 'Héctor Ramírez Benítez',
    telefonoDestinatario: '+52 55 1100 2299',
    direccion: 'Calle Hamburgo 82, Col. Juárez',
    zona: 'Zona Rosa / Cuauhtémoc',
    lat: 19.4260,
    lng: -99.1640,
    urgente: false,
    estado: 'FALLIDO',
    repartidor: { id: 'drv-ana', nombre: 'Ana Martínez', unidad: 'Van Eléctrica #01' },
    requiereRevision: true,
    creadoEn: '2026-11-06T07:00:00Z',
    actualizadoEn: '2026-11-06T09:15:00Z',
    eta: 'Requiere Revisión',
    progreso: 20,
    notas: 'Dirección no encontrada / número no visible.',
    eventos: [
      { tipo: 'CREADO', ocurridoEn: '6 nov 2026, 7:00 a. m.', detalle: 'Paquete recibido en centro logístico' },
      { tipo: 'ASIGNADO', ocurridoEn: '6 nov 2026, 7:35 a. m.', detalle: 'Asignado a Ana Martínez' },
      { tipo: 'EN_RUTA', ocurridoEn: '6 nov 2026, 8:20 a. m.', detalle: 'En camino a destino' },
      { tipo: 'FALLIDO', ocurridoEn: '6 nov 2026, 9:15 a. m.', detalle: 'Intento fallido: Número exterior inexistente en la cuadra', motivo: 'Dirección incorrecta' }
    ]
  }
];

export const DispatcherDashboard: React.FC = () => {
  const { logout } = useAuth();

  // Estados principales
  const [packages, setPackages] = useState<PackageRecord[]>(INITIAL_PACKAGES_RENE);
  const [drivers] = useState<DriverItem[]>(MOCK_DRIVERS_LIST);
  
  // Pestaña Principal Superior (Consola Web Despacho, Radar Táctico y Rastreo Público)
  const [mainNavTab, setMainNavTab] = useState<'admin' | 'mapa' | 'tracking'>('admin');
  
  // Subpestañas dentro de A. Web Despacho
  const [adminSubTab, setAdminSubTab] = useState<'tabla' | 'choferes' | 'stats'>('tabla');

  // Filtros de la tabla
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDriver, setFilterDriver] = useState<string>('ALL');
  const [filterRevisionOnly, setFilterRevisionOnly] = useState<boolean>(false);

  // Estados de Modales
  const [isNewPackageModalOpen, setIsNewPackageModalOpen] = useState(false);
  const [selectedDetailPackage, setSelectedDetailPackage] = useState<PackageRecord | null>(null);
  const [reassignPackage, setReassignPackage] = useState<PackageRecord | null>(null);
  const [selectedDriverForReassign, setSelectedDriverForReassign] = useState<string>('drv-ana');

  // Formulario de Alta de Envío
  const [formRecipient, setFormRecipient] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formZone, setFormZone] = useState('Polanco / Chapultepec');
  const [formLat, setFormLat] = useState(19.4326);
  const [formLng, setFormLng] = useState(-99.1332);
  const [formDriverId, setFormDriverId] = useState('drv-ana');
  const [formUrgent, setFormUrgent] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de Rastreo Público
  const [trackingSearchInput, setTrackingSearchInput] = useState('ET-104921');
  const [activeTrackingPackage, setActiveTrackingPackage] = useState<PackageRecord | null>(INITIAL_PACKAGES_RENE[1]);

  // Referencias a Leaflet para el tab B. Mapa & Radar
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const currentRefLayerRef = useRef<L.TileLayer | null>(null);

  // Estados de Configuración del Mapa
  const [mapTheme, setMapTheme] = useState<MapThemeKey>('calles'); // Calles a Color por defecto
  const [showVehicles, setShowVehicles] = useState<boolean>(true);
  const [showPackages, setShowPackages] = useState<boolean>(true);
  const [mapReady, setMapReady] = useState(0);

  // Inicialización de Leaflet cuando se activa la pestaña de Mapa
  useEffect(() => {
    if (mainNavTab !== 'mapa') {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        currentTileLayerRef.current = null;
        currentRefLayerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        return;
      }

      const map = L.map(mapContainerRef.current, {
        center: [19.4270, -99.1677],
        zoom: 13,
        zoomControl: false,
      });

      // Cargar capa inicial (Calles con color estilo Google Maps)
      const theme = MAP_THEMES[mapTheme];
      const tileLayer = L.tileLayer(theme.url, {
        attribution: theme.attribution,
        maxZoom: theme.maxZoom,
      }).addTo(map);
      currentTileLayerRef.current = tileLayer;

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      const vehiclesLayer = L.layerGroup().addTo(map);
      vehiclesLayerRef.current = vehiclesLayer;

      const routeLayer = L.layerGroup().addTo(map);
      routeLayerRef.current = routeLayer;

      mapInstanceRef.current = map;
      map.invalidateSize();
      setMapReady((v) => v + 1);
    }, 60);

    return () => {
      clearTimeout(timer);
    };
  }, [mainNavTab]);

  // Cambiar tema de mapa dinámicamente sin recargar la página
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
      currentTileLayerRef.current = null;
    }
    if (currentRefLayerRef.current) {
      map.removeLayer(currentRefLayerRef.current);
      currentRefLayerRef.current = null;
    }

    const theme = MAP_THEMES[mapTheme];
    const newTile = L.tileLayer(theme.url, {
      attribution: theme.attribution,
      maxZoom: theme.maxZoom,
    }).addTo(map);
    currentTileLayerRef.current = newTile;

    if (mapTheme === 'dark') {
      const refLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        attribution: '',
        maxZoom: 18,
      }).addTo(map);
      currentRefLayerRef.current = refLayer;
    } else if (mapTheme === 'satelite') {
      const refLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: '',
        maxZoom: 18,
      }).addTo(map);
      currentRefLayerRef.current = refLayer;
    }
  }, [mapTheme]);

  // Dibujar marcadores de Camiones/Camionetas y Paradas de Paquetes
  useEffect(() => {
    if (mainNavTab !== 'mapa' || !mapInstanceRef.current || !markersLayerRef.current || !vehiclesLayerRef.current || !routeLayerRef.current) return;

    const markersLayer = markersLayerRef.current;
    const vehiclesLayer = vehiclesLayerRef.current;
    const routeLayer = routeLayerRef.current;

    markersLayer.clearLayers();
    vehiclesLayer.clearLayers();
    routeLayer.clearLayers();

    // Trazar línea de ruta 2-opt de Ana Martínez
    const anaRouteCoords: [number, number][] = [
      [19.4245, -99.1660], // Inicio: Van Ana Martínez
      [19.4270, -99.1677], // Parada 1: ET-104920 (Reforma)
      [19.4195, -99.1610], // Parada 2: ET-104921 (Roma Norte)
      [19.3820, -99.1605], // Parada 3: ET-104925 (Del Valle)
      [19.4260, -99.1640]  // Parada 4: ET-104926 (Juárez)
    ];
    L.polyline(anaRouteCoords, {
      color: '#00F5A0',
      weight: 3.5,
      opacity: 0.9,
      dashArray: '8, 8'
    }).addTo(routeLayer);

    // 1. DIBUJAR VEHÍCULOS (Camionetas, Camiones y Motos en Ruta)
    if (showVehicles) {
      ACTIVE_FLEET_VEHICLES.forEach((veh) => {
        const vehicleHtml = `
          <div style="position: relative; display: inline-flex; align-items: center; cursor: pointer; white-space: nowrap; transform: translate(-50%, -50%);">
            <div style="display: flex; align-items: center; gap: 7px; background: rgba(11, 17, 30, 0.95); border: 2px solid ${veh.color}; border-radius: 9999px; padding: 3px 10px 3px 5px; box-shadow: 0 4px 16px rgba(0,0,0,0.6), 0 0 14px ${veh.color}80; color: #fff; font-family: 'Inter', sans-serif;">
              <div style="position: relative; width: 28px; height: 28px; border-radius: 9999px; background: ${veh.color}; display: flex; align-items: center; justify-content: center; font-size: 15px; box-shadow: 0 0 10px ${veh.color};">
                <span>${veh.icon}</span>
                <span class="animate-ping-slow" style="position: absolute; inset: -3px; border-radius: 9999px; border: 2px solid ${veh.color}; pointer-events: none;"></span>
              </div>
              <div style="display: flex; flex-direction: column; text-align: left; line-height: 1.15;">
                <div style="font-weight: 800; font-size: 11px; color: #FFFFFF; display: flex; align-items: center; gap: 4px;">
                  <span>${veh.driverName}</span>
                  <span style="font-size: 9px; padding: 1px 5px; border-radius: 4px; background: ${veh.color}25; color: ${veh.color}; font-family: monospace; font-weight: bold; border: 1px solid ${veh.color}60;">${veh.unit}</span>
                </div>
                <div style="font-size: 9px; color: #94A3B8; display: flex; align-items: center; gap: 6px; font-family: monospace;">
                  <span>⚡ ${veh.battery}%</span>
                  <span>•</span>
                  <span>🏎️ ${veh.speed}</span>
                  <span>•</span>
                  <span style="color: #60A5FA;">📦 ${veh.paquetesAsignados} envíos</span>
                </div>
              </div>
            </div>
          </div>
        `;

        const vehicleIcon = L.divIcon({
          className: 'custom-vehicle-marker',
          html: vehicleHtml,
          iconSize: [180, 44],
          iconAnchor: [90, 22],
        });

        const marker = L.marker([veh.lat, veh.lng], { icon: vehicleIcon });
        marker.bindPopup(`
          <div style="padding: 10px; font-family: 'Inter', sans-serif; min-width: 210px; color: #E2E8F0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="font-size: 22px;">${veh.icon}</span>
              <div>
                <div style="font-weight: 800; font-size: 13px; color: #FFF;">${veh.unit}</div>
                <div style="font-size: 11px; color: ${veh.color}; font-weight: 700;">${veh.driverName}</div>
              </div>
            </div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 4px; display: flex; flex-direction: column; gap: 2px;">
              <div><strong>Sector / Zona:</strong> ${veh.zona}</div>
              <div><strong>Velocidad Actual:</strong> ${veh.speed} (${veh.heading})</div>
              <div><strong>Autonomía Batería:</strong> ${veh.battery}%</div>
              <div><strong>Carga Asignada:</strong> ${veh.paquetesAsignados} paquetes activos</div>
            </div>
          </div>
        `);
        marker.addTo(vehiclesLayer);
      });
    }

    // 2. DIBUJAR PUNTOS DE PARADA / PAQUETES (Pines estilizados sin cuadros rotos)
    if (showPackages) {
      packages.forEach((pkg, idx) => {
        const pinColor = pkg.urgente ? '#EF4444' : pkg.estado === 'ENTREGADO' ? '#10B981' : pkg.estado === 'FALLIDO' ? '#F43F5E' : '#3B82F6';
        const stopNumber = idx + 1;

        const pinHtml = `
          <div style="display: inline-flex; flex-direction: column; align-items: center; cursor: pointer; white-space: nowrap; transform: translate(-50%, -100%);">
            <div style="display: flex; align-items: center; gap: 5px; background: rgba(15, 23, 42, 0.95); border: 1.5px solid ${pinColor}; border-radius: 9999px; padding: 2px 8px 2px 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 10px ${pinColor}60; color: #fff; font-family: 'JetBrains Mono', monospace;">
              <span style="width: 18px; height: 18px; border-radius: 9999px; background: ${pinColor}; color: #FFF; font-weight: 900; font-size: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 6px ${pinColor};">#${stopNumber}</span>
              <span style="font-size: 11px; font-weight: 700; color: #F8FAFC;">${pkg.guia}</span>
              ${pkg.urgente ? `<span style="font-size: 9px; font-weight: 800; background: #EF4444; color: #FFF; padding: 1px 4px; border-radius: 4px; box-shadow: 0 0 6px #EF4444;">⚡</span>` : ''}
            </div>
            <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${pinColor}; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));"></div>
            <div style="width: 5px; height: 5px; border-radius: 9999px; background: ${pinColor}; box-shadow: 0 0 6px ${pinColor}; margin-top: -2px;"></div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-package-pin',
          html: pinHtml,
          iconSize: [130, 36],
          iconAnchor: [65, 36],
        });

        const marker = L.marker([pkg.lat, pkg.lng], { icon: customIcon });
        marker.bindPopup(`
          <div style="padding: 10px; font-family: 'Inter', sans-serif; min-width: 220px; color: #E2E8F0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-family: monospace; font-weight: 800; font-size: 13px; color: ${pinColor};">Parada #${stopNumber} &bull; ${pkg.guia}</span>
              ${pkg.urgente ? '<span style="font-size: 10px; background: #EF4444; color: #FFF; padding: 1px 5px; border-radius: 4px; font-weight: bold;">⚡ URGENTE</span>' : ''}
            </div>
            <div style="font-weight: 700; font-size: 12px; color: #FFF; margin-top: 2px;">${pkg.destinatario}</div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">${pkg.direccion}</div>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; display: flex; justify-content: space-between;">
              <span style="color: #94A3B8;">Repartidor:</span>
              <span style="font-weight: 600; color: #60A5FA;">${pkg.repartidor?.nombre || 'Sin chofer'}</span>
            </div>
            <div style="font-size: 11px; display: flex; justify-content: space-between; margin-top: 2px;">
              <span style="color: #94A3B8;">Estado:</span>
              <span style="font-weight: 700; color: ${pinColor};">${pkg.estado}</span>
            </div>
          </div>
        `);
        marker.addTo(markersLayer);
      });
    }
  }, [packages, mainNavTab, mapReady, showVehicles, showPackages]);

  // Filtrado de paquetes en la tabla
  const filteredPackages = packages.filter((pkg) => {
    const matchesSearch =
      pkg.guia.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.destinatario.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.direccion.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || pkg.estado === filterStatus;
    const matchesDriver = filterDriver === 'ALL' || (pkg.repartidor && pkg.repartidor.id === filterDriver);
    const matchesRevision = !filterRevisionOnly || pkg.requiereRevision;

    return matchesSearch && matchesStatus && matchesDriver && matchesRevision;
  });

  const revisionCount = packages.filter((p) => p.requiereRevision).length;

  // Manejar creación de nuevo paquete
  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const driverObj = drivers.find((d) => d.id === formDriverId);
    const newGuia = `ET-${Math.floor(100000 + Math.random() * 900000)}`;

    const newPkg: PackageRecord = {
      id: `pkg-${Date.now()}`,
      guia: newGuia,
      destinatario: formRecipient.trim(),
      telefonoDestinatario: formPhone.trim(),
      direccion: formAddress.trim(),
      zona: formZone,
      lat: formLat,
      lng: formLng,
      urgente: formUrgent,
      estado: formDriverId ? 'ASIGNADO' : 'REGISTRADO',
      repartidor: driverObj ? { id: driverObj.id, nombre: driverObj.nombre, unidad: driverObj.unidad } : null,
      requiereRevision: false,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
      eta: 'En preparación',
      progreso: 25,
      notas: formNotes.trim(),
      eventos: [
        { tipo: 'CREADO', ocurridoEn: new Date().toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), detalle: 'Paquete recibido en centro logístico' }
      ]
    };

    try {
      await apiClient.post('/packages', {
        destinatario: newPkg.destinatario,
        telefonoDestinatario: newPkg.telefonoDestinatario,
        direccion: newPkg.direccion,
        lat: newPkg.lat,
        lng: newPkg.lng,
        urgente: newPkg.urgente,
      });
    } catch {
      // Estado local si la API está offline
    }

    setPackages((prev) => [newPkg, ...prev]);
    setIsSubmitting(false);
    setIsNewPackageModalOpen(false);
  };

  // Manejar reasignación de chofer
  const handleExecuteReassign = () => {
    if (!reassignPackage) return;
    const targetDriver = drivers.find((d) => d.id === selectedDriverForReassign);
    if (!targetDriver) return;

    setPackages((prev) =>
      prev.map((pkg) =>
        pkg.id === reassignPackage.id
          ? {
              ...pkg,
              repartidor: { id: targetDriver.id, nombre: targetDriver.nombre, unidad: targetDriver.unidad },
              estado: pkg.estado === 'REGISTRADO' ? 'ASIGNADO' : pkg.estado,
              eventos: [
                ...pkg.eventos,
                { tipo: 'ASIGNADO', ocurridoEn: new Date().toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), detalle: `Reasignado a ${targetDriver.nombre}` }
              ]
            }
          : pkg
      )
    );
    setReassignPackage(null);
  };

  // Buscar paquete en rastreo público
  const handleExecuteTrackingSearch = (guideToSearch: string) => {
    const found = packages.find((p) => p.guia.toLowerCase() === guideToSearch.trim().toLowerCase());
    if (found) {
      setActiveTrackingPackage(found);
    } else {
      setActiveTrackingPackage(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-[#DDE2F0] flex flex-col font-sans select-none">
      
      {/* ========================================================= */}
      {/* 1. TOP HEADER MULTIPLATAFORMA (Propuesta René + Menú Mapa) */}
      {/* ========================================================= */}
      <header className="h-16 bg-[#0B111E] border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-40 shadow-lg">
        
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-600/30">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                Envío<span className="text-blue-500">Track</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/80 text-blue-400 border border-blue-800/60 font-semibold">
                STITCH AI STUDIO
              </span>
            </div>
            <div className="text-[11px] text-slate-400 hidden sm:block">
              Consola Web de Despacho & Monitoreo Logístico
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN GLOBAL PRINCIPAL (Web Despacho, Radar y Rastreo) */}
        <nav className="flex items-center gap-1.5 bg-[#0F172A] p-1 rounded-xl border border-slate-800">
          
          <button
            onClick={() => setMainNavTab('admin')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              mainNavTab === 'admin'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>A. Web Despacho (ADMIN)</span>
          </button>

          {/* Menú Mapa al lado de A. Web Despacho */}
          <button
            onClick={() => setMainNavTab('mapa')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              mainNavTab === 'mapa'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>B. Radar Táctico & Mapa</span>
          </button>

          <button
            onClick={() => setMainNavTab('tracking')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              mainNavTab === 'tracking'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>C. Rastreo Público</span>
          </button>

        </nav>

        {/* Sesión y Salir */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden xl:block font-mono text-xs text-slate-400">
            <span>Sesión: <strong className="text-white">ADMIN</strong></span>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 hover:border-red-500/60 text-slate-300 hover:text-red-400 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>

      </header>

      {/* ========================================================= */}
      {/* 2. CONTENIDO SEGÚN LA PESTAÑA PRINCIPAL ACTIVA */}
      {/* ========================================================= */}
      <main className={`flex-1 flex flex-col min-h-0 ${mainNavTab === 'mapa' ? 'overflow-hidden' : 'overflow-y-auto'}`}>

        {/* --------------------------------------------------------- */}
        {/* VISTA 1: A. WEB DESPACHO (ADMIN) - Diseño René de la foto */}
        {/* --------------------------------------------------------- */}
        {mainNavTab === 'admin' && (
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex flex-col gap-6">
            
            {/* Sub-Navegación: Tabla de Paquetes / Gestión de Choferes / Dashboard stats */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-[#0B111E] p-1 rounded-xl border border-slate-800 text-xs font-semibold">
                <button
                  onClick={() => setAdminSubTab('tabla')}
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    adminSubTab === 'tabla'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Tabla de Paquetes ({packages.length})</span>
                </button>

                <button
                  onClick={() => setAdminSubTab('choferes')}
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    adminSubTab === 'choferes'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Gestión de Choferes ({drivers.length})</span>
                </button>

                <button
                  onClick={() => setAdminSubTab('stats')}
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    adminSubTab === 'stats'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Dashboard /stats</span>
                </button>
              </div>

              {/* Botón Nuevo Paquete */}
              <button
                onClick={() => setIsNewPackageModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Nuevo Paquete</span>
              </button>
            </div>

            {/* SUB-VISTA: TABLA DE PAQUETES (Foto 1 y 2 de René) */}
            {adminSubTab === 'tabla' && (
              <div className="bg-[#0B111E] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
                
                {/* Barra de Filtros y Búsqueda */}
                <div className="p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-[#0F172A]/50">
                  
                  {/* Input de Búsqueda */}
                  <div className="relative flex-1 min-w-[280px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por guía (ET-...), destinatario o dirección..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#070B14] border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-mono"
                    />
                  </div>

                  {/* Dropdowns de Filtro */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    
                    {/* Filtro Estado */}
                    <div className="flex items-center gap-1.5 bg-[#070B14] px-3 py-2 rounded-xl border border-slate-700/80">
                      <span className="text-slate-400 font-mono">Estado:</span>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="ALL" className="bg-[#0B111E]">Todos los estados</option>
                        <option value="REGISTRADO" className="bg-[#0B111E]">REGISTRADO</option>
                        <option value="ASIGNADO" className="bg-[#0B111E]">ASIGNADO</option>
                        <option value="EN_RUTA" className="bg-[#0B111E]">EN RUTA</option>
                        <option value="ENTREGADO" className="bg-[#0B111E]">ENTREGADO</option>
                        <option value="FALLIDO" className="bg-[#0B111E]">FALLIDO</option>
                      </select>
                    </div>

                    {/* Filtro Chofer */}
                    <div className="flex items-center gap-1.5 bg-[#070B14] px-3 py-2 rounded-xl border border-slate-700/80">
                      <span className="text-slate-400 font-mono">Chofer:</span>
                      <select
                        value={filterDriver}
                        onChange={(e) => setFilterDriver(e.target.value)}
                        className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="ALL" className="bg-[#0B111E]">Todos los choferes</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id} className="bg-[#0B111E]">{d.nombre}</option>
                        ))}
                      </select>
                    </div>

                    {/* Botón Requiere Revisión */}
                    <button
                      onClick={() => setFilterRevisionOnly(!filterRevisionOnly)}
                      className={`px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 border transition ${
                        filterRevisionOnly
                          ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                          : 'bg-[#070B14] border-slate-700/80 text-rose-400 hover:bg-rose-950/30'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Requiere Revisión</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-mono font-bold">
                        {revisionCount}
                      </span>
                    </button>

                  </div>

                </div>

                {/* Tabla de Paquetes Idéntica a la Foto de René */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0F172A] text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">GUÍA</th>
                        <th className="py-3 px-4">DESTINATARIO</th>
                        <th className="py-3 px-4">DIRECCIÓN & ZONA</th>
                        <th className="py-3 px-4 text-center">URGENTE</th>
                        <th className="py-3 px-4 text-center">ESTADO</th>
                        <th className="py-3 px-4">REPARTIDOR</th>
                        <th className="py-3 px-4 text-center">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredPackages.map((pkg) => {
                        const isFailed = pkg.estado === 'FALLIDO';
                        return (
                          <tr
                            key={pkg.id}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              isFailed ? 'bg-rose-950/15' : ''
                            }`}
                          >
                            {/* Guía */}
                            <td className="py-4 px-4 font-mono font-bold text-blue-400 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {pkg.requiereRevision && (
                                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Requiere revisión"></span>
                                )}
                                <span>{pkg.guia}</span>
                              </div>
                            </td>

                            {/* Destinatario */}
                            <td className="py-4 px-4">
                              <div className="font-semibold text-white">{pkg.destinatario}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{pkg.telefonoDestinatario}</div>
                            </td>

                            {/* Dirección & Zona */}
                            <td className="py-4 px-4 max-w-xs">
                              <div className="text-slate-200 truncate font-medium">{pkg.direccion}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                <span className="truncate">{pkg.zona}</span>
                              </div>
                            </td>

                            {/* Urgente */}
                            <td className="py-4 px-4 text-center">
                              {pkg.urgente ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                  ⚡ Sí
                                </span>
                              ) : (
                                <span className="text-slate-500 font-mono text-[11px]">No</span>
                              )}
                            </td>

                            {/* Estado Badge */}
                            <td className="py-4 px-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                                pkg.estado === 'EN_RUTA'
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-600/40'
                                  : pkg.estado === 'ENTREGADO'
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/40'
                                  : pkg.estado === 'FALLIDO'
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-600/60'
                                  : pkg.estado === 'ASIGNADO'
                                  ? 'bg-blue-950/60 text-blue-300 border border-blue-600/40'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  pkg.estado === 'EN_RUTA'
                                    ? 'bg-amber-400 animate-pulse'
                                    : pkg.estado === 'ENTREGADO'
                                    ? 'bg-emerald-400'
                                    : pkg.estado === 'FALLIDO'
                                    ? 'bg-rose-400'
                                    : 'bg-blue-400'
                                }`}></span>
                                <span>{pkg.estado === 'EN_RUTA' ? 'EN RUTA' : pkg.estado}</span>
                              </span>
                            </td>

                            {/* Repartidor */}
                            <td className="py-4 px-4 whitespace-nowrap">
                              {pkg.repartidor ? (
                                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                                  <User className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{pkg.repartidor.nombre}</span>
                                </div>
                              ) : (
                                <span className="text-slate-500 italic">Sin chofer</span>
                              )}
                            </td>

                            {/* Acciones */}
                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                
                                <button
                                  onClick={() => {
                                    setReassignPackage(pkg);
                                    setSelectedDriverForReassign(pkg.repartidor?.id || 'drv-ana');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition"
                                >
                                  {pkg.repartidor ? 'Reasignar' : 'Asignar'}
                                </button>

                                {isFailed && (
                                  <button
                                    onClick={() => {
                                      setPackages((prev) =>
                                        prev.map((p) => (p.id === pkg.id ? { ...p, estado: 'ASIGNADO', requiereRevision: false } : p))
                                      );
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 text-[11px] font-semibold transition"
                                  >
                                    Reprogramar
                                  </button>
                                )}

                                <button
                                  onClick={() => setSelectedDetailPackage(pkg)}
                                  title="Ver detalle del paquete"
                                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer de la Tabla */}
                <div className="p-3 bg-[#0F172A] border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <div>
                    Mostrando <strong className="text-white">{filteredPackages.length}</strong> de <strong className="text-white">{packages.length}</strong> paquetes registrados
                  </div>
                  {revisionCount > 0 && (
                    <div className="flex items-center gap-1.5 text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>Requiere revisión ({revisionCount})</span>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* SUB-VISTA: GESTIÓN DE CHOFERES */}
            {adminSubTab === 'choferes' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {drivers.map((drv) => (
                  <div key={drv.id} className="bg-[#0B111E] rounded-2xl p-5 border border-slate-800 shadow-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                          <User className="w-5 h-5" />
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          drv.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {drv.activo ? 'ACTIVO' : 'DESCANSO'}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-base mt-3">{drv.nombre}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{drv.unidad}</p>
                      <p className="text-xs text-slate-500 mt-2">{drv.zona}</p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Paquetes: <strong className="text-white">{drv.paquetesAsignados}</strong></span>
                      <span className="text-blue-400 font-semibold">{drv.telefono}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SUB-VISTA: DASHBOARD STATS */}
            {adminSubTab === 'stats' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#0B111E] p-6 rounded-2xl border border-slate-800 shadow">
                  <div className="text-xs font-mono text-slate-400 uppercase">Cumplimiento SLA Hoy</div>
                  <div className="text-3xl font-black text-emerald-400 mt-2">99.1%</div>
                  <div className="text-xs text-slate-400 mt-1">+2.3% vs turno previo</div>
                </div>

                <div className="bg-[#0B111E] p-6 rounded-2xl border border-slate-800 shadow">
                  <div className="text-xs font-mono text-slate-400 uppercase">Eficiencia Dinámica 2-OPT</div>
                  <div className="text-3xl font-black text-blue-400 mt-2">98.4%</div>
                  <div className="text-xs text-slate-400 mt-1">Tiempo Real • 0 cruces</div>
                </div>

                <div className="bg-[#0B111E] p-6 rounded-2xl border border-slate-800 shadow">
                  <div className="text-xs font-mono text-slate-400 uppercase">Entregas Completadas</div>
                  <div className="text-3xl font-black text-white mt-2">142</div>
                  <div className="text-xs text-slate-400 mt-1">De 160 guías activas</div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* --------------------------------------------------------- */}
        {/* VISTA 2: B. RADAR TÁCTICO & MAPA (Menú integrado al lado) */}
        {/* --------------------------------------------------------- */}
        {mainNavTab === 'mapa' && (
          <div className="flex-1 w-full h-[calc(100vh-105px)] min-h-[550px] relative flex overflow-hidden">
            
            {/* Mapa Leaflet Full Screen */}
            <div className="flex-1 relative h-full min-h-[550px] bg-[#070B14]">
              <div ref={mapContainerRef} className="w-full h-full min-h-[550px] z-10" />

              {/* Controles Flotantes Superiores en el Mapa */}
              <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-[#0B111E]/95 backdrop-blur-md p-2 rounded-2xl border border-slate-800 shadow-2xl text-xs font-mono max-w-[calc(100%-2rem)]">
                
                {/* Selector de Estilo de Mapa */}
                <div className="flex items-center gap-1 bg-[#070B14] p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setMapTheme('calles')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition flex items-center gap-1.5 ${
                      mapTheme === 'calles' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Calles a Color (Estilo Google Maps)"
                  >
                    <span>🗺️ Calles a Color</span>
                  </button>
                  <button
                    onClick={() => setMapTheme('satelite')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition flex items-center gap-1.5 ${
                      mapTheme === 'satelite' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Satélite Fotográfico Real HD"
                  >
                    <span>🛰️ Satélite HD</span>
                  </button>
                  <button
                    onClick={() => setMapTheme('osm')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition flex items-center gap-1.5 ${
                      mapTheme === 'osm' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                    title="OpenStreetMap Estándar"
                  >
                    <span>🌍 OpenStreet</span>
                  </button>
                  <button
                    onClick={() => setMapTheme('dark')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition flex items-center gap-1.5 ${
                      mapTheme === 'dark' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Modo Nocturno / Gris"
                  >
                    <span>🌙 Modo Gris</span>
                  </button>
                </div>

                <div className="h-5 w-[1px] bg-slate-800 hidden md:block"></div>

                {/* Toggles de Camiones / Flota y Paradas */}
                <div className="flex items-center gap-1 bg-[#070B14] p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setShowVehicles(!showVehicles)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition flex items-center gap-1.5 ${
                      showVehicles ? 'bg-[#00F5A0] text-slate-950 shadow' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span>🚚 Camionetas Flota ({ACTIVE_FLEET_VEHICLES.length})</span>
                    <span className={`w-2 h-2 rounded-full ${showVehicles ? 'bg-slate-950' : 'bg-slate-700'}`}></span>
                  </button>
                  <button
                    onClick={() => setShowPackages(!showPackages)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition flex items-center gap-1.5 ${
                      showPackages ? 'bg-blue-500 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span>📦 Paradas Envíos ({packages.length})</span>
                    <span className={`w-2 h-2 rounded-full ${showPackages ? 'bg-white' : 'bg-slate-700'}`}></span>
                  </button>
                </div>

                {/* Botón de Recentrado */}
                <button
                  onClick={() => {
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.flyTo([19.4270, -99.1677], 13);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#0F172A] border border-slate-700 text-slate-300 hover:text-white hover:border-blue-400 text-[11px] font-bold flex items-center gap-1 transition"
                  title="Centrar en CDMX"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Centrar</span>
                </button>
              </div>
            </div>

            {/* Sidebar lateral del Mapa: Camionetas y Cola de Envíos */}
            <div className="w-80 bg-[#0B111E] border-l border-slate-800 flex flex-col h-full shadow-2xl z-20 p-4">
              
              {/* Sección 1: Camionetas en Ruta */}
              <div className="pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>🚚 FLOTA EN RUTA</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-bold">
                    {ACTIVE_FLEET_VEHICLES.length} UNIDADES
                  </span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {ACTIVE_FLEET_VEHICLES.map((veh) => (
                    <div
                      key={veh.id}
                      onClick={() => {
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo([veh.lat, veh.lng], 16);
                        }
                      }}
                      className="p-2 rounded-xl bg-[#070B14] border border-slate-800 hover:border-[#00F5A0] cursor-pointer transition flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{veh.icon}</span>
                        <div>
                          <div className="font-bold text-white text-[11px]">{veh.driverName}</div>
                          <div className="text-[10px] text-slate-400">{veh.unit}</div>
                        </div>
                      </div>
                      <div className="text-right text-[10px] font-mono">
                        <div className="text-emerald-400 font-bold">⚡ {veh.battery}%</div>
                        <div className="text-slate-500">{veh.speed}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sección 2: Cola de Envíos En Ruta */}
              <div className="flex-1 flex flex-col min-h-0 pt-3">
                <div className="flex items-center justify-between pb-2">
                  <span className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>📦 PARADAS ASIGNADAS</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-600/20 text-blue-400 font-bold">
                    {packages.filter((p) => p.estado === 'EN_RUTA').length} EN CAMINO
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto py-1 space-y-2 pr-1">
                  {packages.filter((p) => p.estado === 'EN_RUTA').map((pkg, idx) => (
                    <div
                      key={pkg.id}
                      onClick={() => {
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo([pkg.lat, pkg.lng], 16);
                        }
                      }}
                      className="p-2.5 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-blue-500 cursor-pointer transition"
                    >
                      <div className="flex justify-between items-center text-xs font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="text-blue-400 font-bold">{pkg.guia}</span>
                        </div>
                        <span className="text-amber-400 font-semibold text-[11px]">{pkg.eta}</span>
                      </div>
                      <div className="text-xs text-white font-semibold mt-1 truncate">{pkg.destinatario}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{pkg.direccion}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 mt-2">
                <button
                  onClick={() => setIsNewPackageModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Alta Rápida de Envío</span>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* --------------------------------------------------------- */}
        {/* VISTA 3: C. RASTREO PÚBLICO (Fotos 3 y 4 de René) */}
        {/* --------------------------------------------------------- */}
        {mainNavTab === 'tracking' && (
          <div className="p-4 sm:p-6 lg:p-8 max-w-4xl w-full mx-auto flex flex-col gap-6">
            
            {/* Header de Rastreo con Formulario */}
            <div className="bg-[#0B111E] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/60 text-blue-400 text-xs font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Rastreo Público Seguro • Sin Inicio de Sesión</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Rastrea tu paquete con tu Número de Guía
              </h2>
              <p className="text-xs text-slate-400 max-w-lg">
                Ingresa tu código con formato <strong className="text-blue-400">ET-XXXXXX</strong> para consultar la ubicación en tiempo real, historial de eventos y evidencias de entrega con protección estricta de privacidad.
              </p>

              {/* Barra de Búsqueda Grande */}
              <div className="w-full max-w-md flex gap-2 mt-2">
                <div className="relative flex-1">
                  <Package className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={trackingSearchInput}
                    onChange={(e) => setTrackingSearchInput(e.target.value.toUpperCase())}
                    placeholder="ET-104921"
                    className="w-full bg-[#070B14] border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm font-mono text-white uppercase placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => handleExecuteTrackingSearch(trackingSearchInput)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition"
                >
                  <Search className="w-4 h-4" />
                  <span>Rastrear</span>
                </button>
              </div>

              {/* Chips de Guías de Prueba */}
              <div className="flex items-center gap-2 flex-wrap justify-center text-xs font-mono text-slate-400 mt-2">
                <span>Guías de prueba:</span>
                {['ET-104920', 'ET-104921', 'ET-104922', 'ET-104924', 'ET-999999'].map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      setTrackingSearchInput(g);
                      handleExecuteTrackingSearch(g);
                    }}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      trackingSearchInput === g
                        ? 'bg-blue-600 text-white border-blue-500 font-bold'
                        : 'bg-[#070B14] border-slate-800 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Resultado de Rastreo (Idéntico a la Foto 4 de René) */}
            {activeTrackingPackage ? (
              <div className="bg-[#0B111E] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
                
                {/* Cabecera del Paquete y Privacidad */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-mono font-bold text-white">{activeTrackingPackage.guia}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase ${
                        activeTrackingPackage.estado === 'ENTREGADO'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : activeTrackingPackage.estado === 'EN_RUTA'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : activeTrackingPackage.estado === 'FALLIDO'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {activeTrackingPackage.estado}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      Creado el viernes, 6 de noviembre de 2026
                    </div>
                  </div>

                  {/* Tarjeta de Privacidad de Destinatario */}
                  <div className="bg-[#0F172A] p-3 rounded-2xl border border-slate-800 flex items-start gap-2.5 max-w-xs text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-200">Destinatario Protegido (Privacidad Rúbrica):</div>
                      <div className="font-mono text-emerald-400 font-bold mt-0.5">
                        {activeTrackingPackage.destinatario.split(' ')[0]} {activeTrackingPackage.destinatario.split(' ')[1]?.[0] || ''}***
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Por seguridad, no se expone dirección exacta ni número telefónico.
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEPPER DE PROGRESO DEL ENVÍO */}
                <div>
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-3">
                    PROGRESO DEL ENVÍO
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                    
                    <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-600/60 text-blue-300">
                      <div className="font-bold">1. Recibido</div>
                      <div className="text-[10px] text-slate-400">En bodega</div>
                    </div>

                    <div className={`p-3 rounded-xl border ${
                      ['ASIGNADO', 'EN_RUTA', 'ENTREGADO'].includes(activeTrackingPackage.estado)
                        ? 'bg-blue-950/40 border-blue-600/60 text-blue-300'
                        : 'bg-[#070B14] border-slate-800 text-slate-500'
                    }`}>
                      <div className="font-bold">2. Asignado</div>
                      <div className="text-[10px] text-slate-400">Preparando ruta</div>
                    </div>

                    <div className={`p-3 rounded-xl border ${
                      ['EN_RUTA', 'ENTREGADO'].includes(activeTrackingPackage.estado)
                        ? 'bg-blue-950/40 border-blue-600/60 text-blue-300'
                        : 'bg-[#070B14] border-slate-800 text-slate-500'
                    }`}>
                      <div className="font-bold">3. En Camino</div>
                      <div className="text-[10px] text-slate-400">Con repartidor</div>
                    </div>

                    <div className={`p-3 rounded-xl border ${
                      activeTrackingPackage.estado === 'ENTREGADO'
                        ? 'bg-emerald-950/40 border-emerald-600 text-emerald-300 font-bold'
                        : 'bg-[#070B14] border-slate-800 text-slate-500'
                    }`}>
                      <div className="font-bold">4. Entregado</div>
                      <div className="text-[10px] text-slate-400">Concluido</div>
                    </div>

                  </div>
                </div>

                {/* HISTORIAL DE EVENTOS DEL PAQUETE (Timeline) */}
                <div>
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4">
                    Historial de Eventos del Paquete
                  </div>

                  <div className="space-y-4 relative pl-6 border-l border-slate-800 ml-2">
                    {activeTrackingPackage.eventos.map((ev, idx) => (
                      <div key={idx} className="relative">
                        <span className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-[#0B111E] ${
                          ev.tipo === 'ENTREGADO' ? 'bg-emerald-500' : ev.tipo === 'FALLIDO' ? 'bg-rose-500' : 'bg-blue-500'
                        }`}></span>

                        <div className="bg-[#0F172A] p-4 rounded-xl border border-slate-800/80 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-white">{ev.tipo}</span>
                            <span className="text-[11px] font-mono text-slate-400">{ev.ocurridoEn}</span>
                          </div>
                          <div className="text-xs text-slate-300">{ev.detalle}</div>

                          {ev.firma && (
                            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-emerald-400">
                              <span className="flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5" />
                                Ver Evidencia Fotográfica y Coordenadas GPS
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">Verificado</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>

              </div>
            ) : (
              <div className="bg-[#0B111E] border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-500 opacity-60" />
                <h4 className="font-bold text-white">No se encontró la guía ingresada</h4>
                <p className="text-xs text-slate-400 mt-1">Prueba seleccionando una de las guías de prueba como ET-104921.</p>
              </div>
            )}

          </div>
        )}


      </main>

      {/* ========================================================= */}
      {/* 3. MODAL: NUEVO PAQUETE */}
      {/* ========================================================= */}
      {isNewPackageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0B111E] border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            
            <div className="p-5 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-[#0B111E] z-10">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-500" />
                <span>Alta de Nuevo Envío</span>
              </h3>
              <button onClick={() => setIsNewPackageModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="p-6 space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 mb-1">Nombre Completo del Destinatario *</label>
                <input
                  type="text"
                  required
                  value={formRecipient}
                  onChange={(e) => setFormRecipient(e.target.value)}
                  placeholder="Lic. Frida Cosijoeza Mendoza"
                  className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Teléfono Móvil *</label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+52 55 4123 9901"
                    className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Zona / Cuadrante</label>
                  <input
                    type="text"
                    value={formZone}
                    onChange={(e) => setFormZone(e.target.value)}
                    placeholder="Polanco / Cuauhtémoc"
                    className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Dirección Completa *</label>
                <input
                  type="text"
                  required
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Av. Paseo de la Reforma 222..."
                  className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px]">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    value={formLat}
                    onChange={(e) => setFormLat(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px]">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    value={formLng}
                    onChange={(e) => setFormLng(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Chofer Asignado</label>
                <select
                  value={formDriverId}
                  onChange={(e) => setFormDriverId(e.target.value)}
                  className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white cursor-pointer"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id} className="bg-[#0B111E]">{d.nombre} — {d.unidad}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Notas / Referencias de Entrega</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Piso 8, timbre B, dejar con recepción..."
                  className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-[#0F172A] rounded-xl flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span>⚡ Marcar como URGENTE</span>
                </span>
                <input
                  type="checkbox"
                  checked={formUrgent}
                  onChange={(e) => setFormUrgent(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewPackageModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Crear Guía
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MODAL: DETALLE Y EVENTOS */}
      {/* ========================================================= */}
      {selectedDetailPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0B111E] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <span className="font-mono text-lg font-bold text-blue-400">{selectedDetailPackage.guia}</span>
                <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300">
                  {selectedDetailPackage.estado}
                </span>
              </div>
              <button onClick={() => setSelectedDetailPackage(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div><strong className="text-slate-400">Destinatario:</strong> <span className="text-white font-semibold">{selectedDetailPackage.destinatario}</span></div>
              <div><strong className="text-slate-400">Teléfono:</strong> <span className="text-slate-300 font-mono">{selectedDetailPackage.telefonoDestinatario}</span></div>
              <div><strong className="text-slate-400">Dirección:</strong> <span className="text-slate-300">{selectedDetailPackage.direccion}</span></div>
              <div><strong className="text-slate-400">Zona:</strong> <span className="text-slate-300">{selectedDetailPackage.zona}</span></div>
              <div><strong className="text-slate-400">Chofer:</strong> <span className="text-blue-400 font-semibold">{selectedDetailPackage.repartidor?.nombre || 'Sin chofer'}</span></div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800">
              <div className="text-xs font-mono text-slate-400 uppercase mb-2">Historial de Eventos</div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedDetailPackage.eventos.map((ev, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-[#0F172A] border border-slate-800 text-xs">
                    <div className="flex justify-between font-mono font-bold text-white">
                      <span>{ev.tipo}</span>
                      <span className="text-[10px] text-slate-400">{ev.ocurridoEn}</span>
                    </div>
                    <div className="text-slate-300 text-[11px] mt-0.5">{ev.detalle}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. MODAL: REASIGNAR CHOFER */}
      {/* ========================================================= */}
      {reassignPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0B111E] border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-base text-white">Reasignar Chofer — {reassignPackage.guia}</h3>
            
            <div className="text-xs text-slate-400">
              Selecciona el repartidor activo para transferir este paquete:
            </div>

            <select
              value={selectedDriverForReassign}
              onChange={(e) => setSelectedDriverForReassign(e.target.value)}
              className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              {drivers.filter((d) => d.activo).map((d) => (
                <option key={d.id} value={d.id} className="bg-[#0B111E]">
                  {d.nombre} — {d.unidad}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setReassignPackage(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteReassign}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Global */}
      <footer className="h-10 bg-[#0B111E] border-t border-slate-800 px-6 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <div>EnvíoTrack • Proyecto Escolar de Paquetería & Rúbrica de Diseño</div>
        <div className="flex items-center gap-4">
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            WCAG AA Conforme
          </span>
          <span>Leaflet + OpenStreetMap sin API Keys</span>
        </div>
      </footer>

    </div>
  );
};
