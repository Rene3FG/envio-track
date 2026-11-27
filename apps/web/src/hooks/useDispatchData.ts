import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { DriverItem, PackageRecord, PackageStatus } from '../types/dispatch';
import { INITIAL_DRIVERS, INITIAL_PACKAGES } from '../data/initialDispatchData';
import { PackageFormValues } from '../components/PackageFormModal';
import { DriverFormValues } from '../components/DriverFormModal';

export const DISPATCH_QUERY_KEYS = {
  packages: ['dispatch', 'packages'] as const,
  drivers: ['dispatch', 'drivers'] as const,
};

interface ApiPackageDto {
  id: string;
  guia: string;
  destinatario: string;
  telefonoDestinatario: string | null;
  direccion: string;
  referencias: string | null;
  lat: number;
  lng: number;
  urgente: boolean;
  estado: PackageStatus;
  repartidor: { id: string; nombre: string } | null;
  requiereRevision?: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

interface ApiPaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

interface ApiUserDto {
  id: string;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'REPARTIDOR';
  activo: boolean;
  creadoEn: string;
}

function formatNowLabel(): string {
  return new Date().toLocaleDateString('es-MX', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapApiPackageToRecord(dto: ApiPackageDto): PackageRecord {
  const progressMap: Record<PackageStatus, number> = {
    REGISTRADO: 10,
    ASIGNADO: 30,
    EN_RUTA: 65,
    ENTREGADO: 100,
    FALLIDO: 20,
  };

  return {
    id: dto.id,
    guia: dto.guia,
    destinatario: dto.destinatario,
    telefonoDestinatario: dto.telefonoDestinatario ?? 'Sin teléfono',
    direccion: dto.direccion,
    zona: 'Oaxaca',
    lat: dto.lat,
    lng: dto.lng,
    urgente: dto.urgente,
    estado: dto.estado,
    repartidor: dto.repartidor ? { id: dto.repartidor.id, nombre: dto.repartidor.nombre } : null,
    requiereRevision: Boolean(dto.requiereRevision),
    creadoEn: dto.creadoEn,
    actualizadoEn: dto.actualizadoEn,
    eta: dto.estado === 'ENTREGADO' ? 'Entregado' : dto.repartidor ? 'En ruta' : 'Pendiente Chofer',
    progreso: progressMap[dto.estado] ?? 25,
    referencias: dto.referencias ?? undefined,
    notas: dto.referencias ?? undefined,
    eventos: [
      {
        tipo: 'CREADO',
        ocurridoEn: new Date(dto.creadoEn).toLocaleDateString('es-MX', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        detalle: 'Paquete registrado en servidor',
      },
    ],
  };
}

function mapApiUserToDriver(dto: ApiUserDto, index: number): DriverItem {
  const fallback = INITIAL_DRIVERS.find(
    (d) => d.email.toLowerCase() === dto.email.toLowerCase() || d.id === dto.id
  );
  return {
    id: dto.id,
    nombre: dto.nombre,
    email: dto.email,
    unidad: fallback?.unidad ?? `Unidad #${String(index + 1).padStart(2, '0')}`,
    tipo: fallback?.tipo ?? 'VAN',
    telefono: fallback?.telefono ?? '+52 951 000 0000',
    activo: dto.activo,
    paquetesAsignados: fallback?.paquetesAsignados ?? 0,
    capacidadMaxima: fallback?.capacidadMaxima ?? 15,
    bateria: fallback?.bateria ?? 90,
    zona: fallback?.zona ?? 'Oaxaca Centro',
  };
}

export function usePackagesQuery() {
  return useQuery<PackageRecord[]>({
    queryKey: DISPATCH_QUERY_KEYS.packages,
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<ApiPaginatedResponse<ApiPackageDto>>('/packages', {
          params: { page: 1, pageSize: 100 },
        });
        if (Array.isArray(data?.data) && data.data.length > 0) {
          return data.data.map(mapApiPackageToRecord);
        }
        return INITIAL_PACKAGES;
      } catch {
        return INITIAL_PACKAGES;
      }
    },
    initialData: INITIAL_PACKAGES,
    staleTime: 60_000,
    retry: false,
  });
}

export function useDriversQuery() {
  return useQuery<DriverItem[]>({
    queryKey: DISPATCH_QUERY_KEYS.drivers,
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<ApiPaginatedResponse<ApiUserDto>>('/users', {
          params: { rol: 'REPARTIDOR', page: 1, pageSize: 100 },
        });
        if (Array.isArray(data?.data) && data.data.length > 0) {
          return data.data.map(mapApiUserToDriver);
        }
        return INITIAL_DRIVERS;
      } catch {
        return INITIAL_DRIVERS;
      }
    },
    initialData: INITIAL_DRIVERS,
    staleTime: 60_000,
    retry: false,
  });
}

export function useCreatePackageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { values: PackageFormValues; driver?: DriverItem }) => {
      const { values, driver } = params;
      let createdId = `pkg-${Date.now()}`;
      let createdGuia = `ET-${Math.floor(100000 + Math.random() * 900000)}`;
      const timestampLabel = formatNowLabel();

      try {
        const response = await apiClient.post<{ id?: string; guia?: string }>('/packages', {
          destinatario: values.destinatario,
          telefonoDestinatario: values.telefonoDestinatario || undefined,
          direccion: values.direccion,
          referencias: values.referencias || undefined,
          lat: values.lat,
          lng: values.lng,
          urgente: values.urgente,
        });

        if (response.data?.id) createdId = response.data.id;
        if (response.data?.guia) createdGuia = response.data.guia;

        if (driver) {
          await apiClient.post(`/packages/${createdId}/assignment`, {
            repartidorId: driver.id,
          });
        }
      } catch {
        // Respaldo local si la API no está disponible
      }

      const eventos: PackageRecord['eventos'] = [
        {
          tipo: 'CREADO',
          ocurridoEn: timestampLabel,
          detalle: `Paquete recibido en centro logístico (${values.zona})`,
        },
      ];

      if (driver) {
        eventos.push({
          tipo: 'ASIGNADO',
          ocurridoEn: timestampLabel,
          detalle: `Asignado a ${driver.nombre} (${driver.unidad})`,
        });
      }

      const newPkg: PackageRecord = {
        id: createdId,
        guia: createdGuia,
        destinatario: values.destinatario,
        telefonoDestinatario: values.telefonoDestinatario || 'Sin teléfono',
        direccion: values.direccion,
        zona: values.zona,
        lat: values.lat,
        lng: values.lng,
        urgente: values.urgente,
        estado: driver ? 'ASIGNADO' : 'REGISTRADO',
        repartidor: driver ? { id: driver.id, nombre: driver.nombre, unidad: driver.unidad } : null,
        requiereRevision: false,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
        eta: driver ? 'En preparación' : 'Pendiente Chofer',
        progreso: driver ? 25 : 10,
        referencias: values.referencias,
        notas: values.referencias,
        eventos,
      };

      return newPkg;
    },
    onSuccess: (newPkg) => {
      queryClient.setQueryData<PackageRecord[]>(DISPATCH_QUERY_KEYS.packages, (prev = INITIAL_PACKAGES) => [
        newPkg,
        ...prev,
      ]);
    },
  });
}

export function useUpdatePackageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { existing: PackageRecord; values: PackageFormValues }) => {
      const { existing, values } = params;
      const nowIso = new Date().toISOString();
      const timestampLabel = formatNowLabel();

      try {
        await apiClient.patch(`/packages/${existing.id}`, {
          destinatario: values.destinatario,
          telefonoDestinatario: values.telefonoDestinatario || undefined,
          direccion: values.direccion,
          referencias: values.referencias || undefined,
          lat: values.lat,
          lng: values.lng,
          urgente: values.urgente,
        });
      } catch {
        // Respaldo local si la API no está disponible
      }

      const updatedPkg: PackageRecord = {
        ...existing,
        destinatario: values.destinatario,
        telefonoDestinatario: values.telefonoDestinatario || 'Sin teléfono',
        direccion: values.direccion,
        zona: values.zona,
        lat: values.lat,
        lng: values.lng,
        urgente: values.urgente,
        referencias: values.referencias,
        notas: values.referencias,
        actualizadoEn: nowIso,
        eventos: [
          ...existing.eventos,
          {
            tipo: 'ACTUALIZADO',
            ocurridoEn: timestampLabel,
            detalle: `Datos de entrega actualizados (${values.zona} • ${values.lat.toFixed(4)}, ${values.lng.toFixed(4)})`,
          },
        ],
      };

      return updatedPkg;
    },
    onSuccess: (updatedPkg) => {
      queryClient.setQueryData<PackageRecord[]>(DISPATCH_QUERY_KEYS.packages, (prev = INITIAL_PACKAGES) =>
        prev.map((pkg) => (pkg.id === updatedPkg.id ? updatedPkg : pkg))
      );
    },
  });
}

export function useAssignPackageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { packageId: string; driver: DriverItem; detailPrefix?: string }) => {
      const { packageId, driver, detailPrefix } = params;

      try {
        await apiClient.post(`/packages/${packageId}/assignment`, {
          repartidorId: driver.id,
        });
      } catch {
        // Respaldo local si la API no está disponible
      }

      return { packageId, driver, detailPrefix };
    },
    onSuccess: ({ packageId, driver, detailPrefix }) => {
      const timestampLabel = formatNowLabel();
      queryClient.setQueryData<PackageRecord[]>(DISPATCH_QUERY_KEYS.packages, (prev = INITIAL_PACKAGES) =>
        prev.map((pkg) =>
          pkg.id === packageId
            ? {
                ...pkg,
                repartidor: { id: driver.id, nombre: driver.nombre, unidad: driver.unidad },
                estado: pkg.estado === 'REGISTRADO' || pkg.estado === 'FALLIDO' ? 'ASIGNADO' : pkg.estado,
                requiereRevision: false,
                actualizadoEn: new Date().toISOString(),
                eventos: [
                  ...pkg.eventos,
                  {
                    tipo: 'ASIGNADO',
                    ocurridoEn: timestampLabel,
                    detalle: detailPrefix
                      ? `${detailPrefix} ${driver.nombre} (${driver.unidad})`
                      : `Reasignado a ${driver.nombre}`,
                  },
                ],
              }
            : pkg
        )
      );
    },
  });
}

export function useUnassignPackageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (packageId: string) => packageId,
    onSuccess: (packageId) => {
      const timestampLabel = formatNowLabel();
      queryClient.setQueryData<PackageRecord[]>(DISPATCH_QUERY_KEYS.packages, (prev = INITIAL_PACKAGES) =>
        prev.map((pkg) =>
          pkg.id === packageId
            ? {
                ...pkg,
                estado: 'REGISTRADO',
                repartidor: null,
                actualizadoEn: new Date().toISOString(),
                eventos: [
                  ...pkg.eventos,
                  {
                    tipo: 'ACTUALIZADO',
                    ocurridoEn: timestampLabel,
                    detalle: 'Descargado del vehículo a bodega para reasignación',
                  },
                ],
              }
            : pkg
        )
      );
    },
  });
}

export function useReprogramPackageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (packageId: string) => packageId,
    onSuccess: (packageId) => {
      queryClient.setQueryData<PackageRecord[]>(DISPATCH_QUERY_KEYS.packages, (prev = INITIAL_PACKAGES) =>
        prev.map((p) => (p.id === packageId ? { ...p, estado: 'ASIGNADO', requiereRevision: false } : p))
      );
    },
  });
}

export function useCreateDriverMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: DriverFormValues) => {
      let createdId = `drv-${Date.now()}`;

      try {
        const response = await apiClient.post<{ id?: string }>('/users', {
          nombre: values.nombre,
          email: values.email,
          password: values.password,
          rol: 'REPARTIDOR',
        });
        if (response.data?.id) {
          createdId = response.data.id;
        }
      } catch {
        // Respaldo local si la API no está disponible
      }

      const newDriver: DriverItem = {
        id: createdId,
        nombre: values.nombre,
        email: values.email,
        unidad: values.unidad,
        tipo: values.tipo,
        telefono: values.telefono,
        activo: true,
        paquetesAsignados: 0,
        capacidadMaxima: values.capacidadMaxima,
        bateria: 100,
        zona: values.zona,
      };

      return newDriver;
    },
    onSuccess: (newDriver) => {
      queryClient.setQueryData<DriverItem[]>(DISPATCH_QUERY_KEYS.drivers, (prev = INITIAL_DRIVERS) => [
        newDriver,
        ...prev,
      ]);
    },
  });
}

export function useUpdateDriverMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { driverId: string; values: DriverFormValues }) => {
      const { driverId, values } = params;

      try {
        await apiClient.patch(`/users/${driverId}`, {
          nombre: values.nombre,
          email: values.email,
          ...(values.password ? { password: values.password } : {}),
        });
      } catch {
        // Respaldo local si la API no está disponible
      }

      return { driverId, values };
    },
    onSuccess: ({ driverId, values }) => {
      queryClient.setQueryData<DriverItem[]>(DISPATCH_QUERY_KEYS.drivers, (prev = INITIAL_DRIVERS) =>
        prev.map((d) =>
          d.id === driverId
            ? {
                ...d,
                nombre: values.nombre,
                email: values.email,
                telefono: values.telefono,
                unidad: values.unidad,
                tipo: values.tipo,
                capacidadMaxima: values.capacidadMaxima,
                zona: values.zona,
              }
            : d
        )
      );

      queryClient.setQueryData<PackageRecord[]>(DISPATCH_QUERY_KEYS.packages, (prev = INITIAL_PACKAGES) =>
        prev.map((pkg) =>
          pkg.repartidor?.id === driverId
            ? {
                ...pkg,
                repartidor: {
                  id: driverId,
                  nombre: values.nombre,
                  unidad: values.unidad,
                },
              }
            : pkg
        )
      );
    },
  });
}

export function useToggleDriverActiveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { driverId: string; nextActive: boolean }) => {
      const { driverId, nextActive } = params;

      try {
        await apiClient.patch(`/users/${driverId}`, { activo: nextActive });
      } catch {
        // Respaldo local si la API no está disponible
      }

      return { driverId, nextActive };
    },
    onSuccess: ({ driverId, nextActive }) => {
      queryClient.setQueryData<DriverItem[]>(DISPATCH_QUERY_KEYS.drivers, (prev = INITIAL_DRIVERS) =>
        prev.map((d) => (d.id === driverId ? { ...d, activo: nextActive } : d))
      );
    },
  });
}
