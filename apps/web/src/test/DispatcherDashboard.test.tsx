import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { DispatcherDashboard } from '../pages/DispatcherDashboard';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>
          <DispatcherDashboard />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DispatcherDashboard (flujos P3 con TanStack Query)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simular respaldo local cuando la API no está arriba
    vi.mocked(apiClient.get).mockRejectedValue(new Error('offline'));
    vi.mocked(apiClient.post).mockRejectedValue(new Error('offline'));
    vi.mocked(apiClient.patch).mockRejectedValue(new Error('offline'));
  });

  it('filtra paquetes por búsqueda, estado y requiere revisión', async () => {
    const user = userEvent.setup();
    renderDashboard();

    expect(screen.getByText('ET-9482')).toBeInTheDocument();
    expect(screen.getByText('ET-3840')).toBeInTheDocument();

    // Filtrar por Requiere Revisión (solo ET-3840)
    await user.click(screen.getByRole('button', { name: /Requiere Revisión/i }));
    expect(screen.getByText('ET-3840')).toBeInTheDocument();
    expect(screen.queryByText('ET-9482')).not.toBeInTheDocument();

    // Quitar filtro de revisión y buscar por texto
    await user.click(screen.getByRole('button', { name: /Requiere Revisión/i }));
    const searchInput = screen.getByPlaceholderText(/Buscar por guía/i);
    await user.type(searchInput, 'ET-6320');

    expect(screen.getByText('ET-6320')).toBeInTheDocument();
    expect(screen.queryByText('ET-9482')).not.toBeInTheDocument();
  });

  it('permite crear un nuevo paquete y lo agrega a la tabla mediante React Query', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /\+ Nuevo Paquete/i }));

    await user.type(
      screen.getByPlaceholderText('Lic. Frida Cosijoeza Mendoza'),
      'Elena Ramírez'
    );
    await user.type(
      screen.getByPlaceholderText('Av. Benito Juárez #302, Oaxaca Centro...'),
      'Calle Independencia #120, Oaxaca Centro'
    );
    await user.click(screen.getByRole('button', { name: /Crear Guía/i }));

    await waitFor(() => {
      expect(screen.getByText('Elena Ramírez')).toBeInTheDocument();
    });
    expect(screen.getByText(/Tabla de Paquetes \(8\)/i)).toBeInTheDocument();
  });

  it('bloquea Terminar turno a un chofer con paquetes activos y permite Iniciar turno a uno inactivo', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /Gestión de Choferes/i }));

    expect(screen.getByText('Xóchitl Ruiz')).toBeInTheDocument();
    expect(screen.getByText('David Morales')).toBeInTheDocument();

    // Intentar terminar turno del primer chofer activo (Xóchitl tiene paquetes EN_RUTA)
    const terminarButtons = screen.getAllByRole('button', { name: /Terminar/i });
    await user.click(terminarButtons[0]);

    expect(
      await screen.findByText(/No se puede terminar el turno de Xóchitl Ruiz/i)
    ).toBeInTheDocument();

    // Iniciar turno a David Morales (inactivo, sin paquetes activos)
    const iniciarBtn = screen.getByRole('button', { name: /Iniciar/i });
    await user.click(iniciarBtn);

    expect(
      await screen.findByText(/David Morales inició turno y ya puede recibir paquetes/i)
    ).toBeInTheDocument();
  });

  it('permite registrar un nuevo chofer desde Gestión de Choferes', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /Gestión de Choferes/i }));
    await user.click(screen.getByRole('button', { name: /Nuevo Chofer/i }));

    await user.type(screen.getByPlaceholderText('Ej. Luis Hernández López'), 'Pedro Martínez');
    await user.type(screen.getByPlaceholderText('chofer@enviotrack.com'), 'pedro@enviotrack.com');
    await user.type(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'clave1234');
    await user.click(screen.getByRole('button', { name: /Registrar Chofer/i }));

    await waitFor(() => {
      expect(screen.getByText('Pedro Martínez')).toBeInTheDocument();
    });
    expect(screen.getByText(/Gestión de Choferes \(5\)/i)).toBeInTheDocument();
  });
});
