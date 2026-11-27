import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PackageFormModal, OAXACA_ZONES } from '../components/PackageFormModal';
import { INITIAL_DRIVERS, INITIAL_PACKAGES } from '../data/initialDispatchData';

const mockGetDriverLoad = () => ({
  current: 2,
  percentage: 13,
  available: 13,
  isFull: false,
  isNearFull: false,
});

describe('PackageFormModal', () => {
  it('actualiza coordenadas al seleccionar una zona rápida de Oaxaca y envía el formulario de alta', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(
      <PackageFormModal
        mode="create"
        drivers={INITIAL_DRIVERS}
        getDriverLoad={mockGetDriverLoad}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    await user.type(
      screen.getByPlaceholderText('Lic. Frida Cosijoeza Mendoza'),
      'Sofía Méndez'
    );
    await user.type(
      screen.getByPlaceholderText('+52 951 516 4020'),
      '+52 951 111 2233'
    );
    await user.type(
      screen.getByPlaceholderText('Av. Benito Juárez #302, Oaxaca Centro...'),
      'Calzada Porfirio Díaz #250, Reforma'
    );
    await user.type(
      screen.getByPlaceholderText('Portón blanco, entregar en recepción...'),
      'Portón azul'
    );

    const reformaPreset = OAXACA_ZONES.find((z) => z.nombre === 'Colonia Reforma')!;
    await user.click(screen.getByRole('button', { name: 'Colonia Reforma' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Crear Guía/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        destinatario: 'Sofía Méndez',
        telefonoDestinatario: '+52 951 111 2233',
        direccion: 'Calzada Porfirio Díaz #250, Reforma',
        referencias: 'Portón azul',
        zona: 'Colonia Reforma',
        lat: reformaPreset.lat,
        lng: reformaPreset.lng,
        urgente: true,
        driverId: '',
      })
    );
  });

  it('precarga datos en modo edición y permite guardar cambios', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const targetPkg = INITIAL_PACKAGES[0];

    render(
      <PackageFormModal
        mode="edit"
        initialPackage={targetPkg}
        drivers={INITIAL_DRIVERS}
        getDriverLoad={mockGetDriverLoad}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText(`Editar Paquete — ${targetPkg.guia}`)).toBeInTheDocument();
    expect(screen.queryByText(/Chofer Asignado/i)).not.toBeInTheDocument();

    const direccionInput = screen.getByDisplayValue(targetPkg.direccion);
    await user.clear(direccionInput);
    await user.type(direccionInput, 'Calle Reforma #500, Oaxaca Centro');
    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          destinatario: targetPkg.destinatario,
          direccion: 'Calle Reforma #500, Oaxaca Centro',
        })
      );
    });
  });

  it('muestra error de validación si el destinatario tiene menos de 2 caracteres', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <PackageFormModal
        mode="create"
        drivers={INITIAL_DRIVERS}
        getDriverLoad={mockGetDriverLoad}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const destInput = screen.getByPlaceholderText('Lic. Frida Cosijoeza Mendoza');
    const dirInput = screen.getByPlaceholderText('Av. Benito Juárez #302, Oaxaca Centro...');
    destInput.removeAttribute('minlength');
    dirInput.removeAttribute('minlength');

    await user.type(destInput, 'A');
    await user.type(dirInput, 'Calle Centro 10');
    await user.click(screen.getByRole('button', { name: /Crear Guía/i }));

    expect(
      await screen.findByText(/El nombre del destinatario debe tener al menos 2 caracteres/i)
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
