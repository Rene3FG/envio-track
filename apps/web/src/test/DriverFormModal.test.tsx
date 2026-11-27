import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DriverFormModal } from '../components/DriverFormModal';
import { INITIAL_DRIVERS } from '../data/initialDispatchData';

describe('DriverFormModal', () => {
  it('rechaza correo duplicado al registrar un nuevo chofer', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <DriverFormModal
        mode="create"
        existingEmails={INITIAL_DRIVERS.map((d) => d.email)}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByPlaceholderText('Ej. Luis Hernández López'), 'Luis Hernández');
    await user.type(screen.getByPlaceholderText('chofer@enviotrack.com'), 'xochitl@enviotrack.com');
    await user.type(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'clave123');
    await user.click(screen.getByRole('button', { name: /Registrar Chofer/i }));

    expect(
      await screen.findByText(/Ya existe un chofer registrado con ese correo electrónico/i)
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ajusta la capacidad sugerida al cambiar tipo de vehículo y registra al chofer', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <DriverFormModal
        mode="create"
        existingEmails={INITIAL_DRIVERS.map((d) => d.email)}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByPlaceholderText('Ej. Luis Hernández López'), 'Marco Antonio Ruiz');
    await user.type(screen.getByPlaceholderText('chofer@enviotrack.com'), 'marco@enviotrack.com');
    await user.type(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'secreto123');
    await user.type(screen.getByPlaceholderText('Van #05'), 'Moto #08');

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[1], 'MOTO');

    const capInput = screen.getByRole('spinbutton');
    expect(capInput).toHaveValue(5);

    await user.click(screen.getByRole('button', { name: /Registrar Chofer/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Marco Antonio Ruiz',
          email: 'marco@enviotrack.com',
          tipo: 'MOTO',
          capacidadMaxima: 5,
          unidad: 'Moto #08',
        })
      );
    });
  });

  it('permite editar un chofer sin cambiar su contraseña', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const targetDriver = INITIAL_DRIVERS[0];

    render(
      <DriverFormModal
        mode="edit"
        initialDriver={targetDriver}
        existingEmails={INITIAL_DRIVERS.map((d) => d.email)}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const unidadInput = screen.getByDisplayValue(targetDriver.unidad);
    await user.clear(unidadInput);
    await user.type(unidadInput, 'Van Eléctrica #10');
    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: targetDriver.nombre,
          email: targetDriver.email,
          password: '',
          unidad: 'Van Eléctrica #10',
        })
      );
    });
  });
});
