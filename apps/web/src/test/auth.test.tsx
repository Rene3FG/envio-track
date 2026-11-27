import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Auth y rutas protegidas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('redirige a /login cuando el usuario no está autenticado', () => {
    render(
      <MemoryRouter initialEntries={['/despacho']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Pantalla Login</div>} />
            <Route
              path="/despacho"
              element={
                <ProtectedRoute requireAdmin>
                  <div>Panel Privado</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Pantalla Login')).toBeInTheDocument();
    expect(screen.queryByText('Panel Privado')).not.toBeInTheDocument();
  });

  it('redirige a /login cuando un REPARTIDOR intenta entrar a una ruta requireAdmin', () => {
    localStorage.setItem(
      'et_user',
      JSON.stringify({
        id: 'drv-1',
        nombre: 'Xóchitl Ruiz',
        email: 'xochitl@enviotrack.com',
        rol: 'REPARTIDOR',
        activo: true,
        creadoEn: '2026-11-09T00:00:00Z',
      })
    );

    render(
      <MemoryRouter initialEntries={['/despacho']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Pantalla Login</div>} />
            <Route
              path="/despacho"
              element={
                <ProtectedRoute requireAdmin>
                  <div>Panel Privado</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Pantalla Login')).toBeInTheDocument();
    expect(screen.queryByText('Panel Privado')).not.toBeInTheDocument();
  });

  it('permite entrar a /despacho al autenticarse desde LoginPage', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        accessToken: 'jwt-access-test',
        refreshToken: 'jwt-refresh-test',
        user: {
          id: 'admin-1',
          nombre: 'Administrador',
          email: 'admin@enviotrack.com',
          rol: 'ADMIN',
          activo: true,
          creadoEn: '2026-11-09T00:00:00Z',
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/despacho"
              element={
                <ProtectedRoute requireAdmin>
                  <div>Panel Despacho Activo</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /AUTENTICAR EN CONSOLA/i }));

    await waitFor(() => {
      expect(screen.getByText('Panel Despacho Activo')).toBeInTheDocument();
    });
    expect(localStorage.getItem('et_access_token')).toBe('jwt-access-test');
  });

  it('permite consultar rastreo público sin iniciar sesión', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/tracking" element={<div>Vista Tracking Público</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    const trackInput = screen.getByPlaceholderText('ET-9482');
    await user.type(trackInput, 'et-9482');
    await user.click(screen.getByRole('button', { name: /Consultar/i }));

    expect(screen.getByText('Vista Tracking Público')).toBeInTheDocument();
  });
});
