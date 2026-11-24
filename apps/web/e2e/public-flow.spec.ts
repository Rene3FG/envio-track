import { expect, test } from '@playwright/test';

const guide = 'ET-123456';

test('admin can log in, create a package, and share its public tracking page', async ({ page }) => {
  let createdPackageBody: Record<string, unknown> | undefined;
  const packageResponse = {
    id: 'package-e2e-1',
    guia: guide,
    destinatario: 'Cliente E2E',
    telefonoDestinatario: '5551234567',
    direccion: 'Calle de prueba 123',
    referencias: 'Recepción',
    lat: 19.432608,
    lng: -99.133209,
    urgente: false,
    estado: 'REGISTRADO',
    repartidor: null,
    creadoEn: '2026-11-23T12:00:00.000Z',
    actualizadoEn: '2026-11-23T12:00:00.000Z',
  };

  await page.context().route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'e2e-access-token',
        refreshToken: 'e2e-refresh-token',
        user: {
          id: 'admin-e2e',
          nombre: 'Admin E2E',
          email: 'admin@envio.test',
          rol: 'ADMIN',
          activo: true,
          creadoEn: '2026-11-23T12:00:00.000Z',
        },
      }),
    });
  });
  await page.context().route('**/api/packages', async (route) => {
    createdPackageBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(packageResponse),
    });
  });
  await page.context().route('**/uploads/evidence-e2e.jpg', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />',
    });
  });
  await page.context().route(`**/api/track/${guide}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        guia: guide,
        estado: 'ENTREGADO',
        destinatario: 'C. E***',
        eventos: [
          {
            tipo: 'CREADO',
            ocurridoEn: '2026-11-22T14:00:00.000Z',
            lat: null,
            lng: null,
            fotoUrl: null,
            motivo: null,
          },
          {
            tipo: 'ENTREGADO',
            ocurridoEn: '2026-11-23T12:00:00.000Z',
            lat: 19.432608,
            lng: -99.133209,
            fotoUrl: '/uploads/evidence-e2e.jpg',
            motivo: null,
          },
        ],
      }),
    });
  });

  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@envio.test');
  await page.locator('input[type="password"]').fill('cambiar123');
  await page.getByRole('button', { name: 'AUTENTICAR EN CONSOLA' }).click();
  await expect(page).toHaveURL(/\/despacho$/);
  await expect(page.getByRole('button', { name: /Tabla de Paquetes/ })).toBeVisible();

  await page.getByRole('button', { name: /Nuevo Paquete/ }).click();
  await expect(page.getByRole('heading', { name: 'Alta de Nuevo Envío' })).toBeVisible();
  await page.getByPlaceholder('Lic. Frida Cosijoeza Mendoza').fill('Cliente E2E');
  await page.getByPlaceholder('+52 951 516 4020').fill('5551234567');
  await page.getByPlaceholder('Av. Benito Juárez #302, Oaxaca Centro...').fill('Calle de prueba 123');
  await page.getByRole('button', { name: 'Crear Guía' }).click();
  await expect(page.getByRole('heading', { name: 'Alta de Nuevo Envío' })).toBeHidden();
  await expect(page.getByText(guide, { exact: true })).toBeVisible();
  expect(createdPackageBody).toMatchObject({
    destinatario: 'Cliente E2E',
    telefonoDestinatario: '5551234567',
    direccion: 'Calle de prueba 123',
  });

  await page.evaluate(() => {
    localStorage.removeItem('et_access_token');
    localStorage.removeItem('et_refresh_token');
    localStorage.removeItem('et_user');
  });
  const publicPage = await page.context().newPage();
  await publicPage.goto(`/tracking/${guide}`);
  await expect(publicPage.getByText('C. E***')).toBeVisible();
  await expect(publicPage.getByText('Entregado', { exact: true })).toBeVisible();
  await publicPage.getByRole('button', { name: 'Ver evidencia de entrega' }).click();
  const evidenceDialog = publicPage.getByRole('dialog', { name: 'Evidencia de entrega' });
  await expect(evidenceDialog).toBeVisible();
  await expect(evidenceDialog.getByText('19.43261, -99.13321')).toBeVisible();
  await expect(evidenceDialog.getByRole('img', { name: 'Fotografía de evidencia de la entrega' })).toHaveAttribute(
    'src',
    '/uploads/evidence-e2e.jpg',
  );
});

test('admin metrics display state totals and packages requiring review', async ({ page }) => {
  await page.context().route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'e2e-access-token',
        refreshToken: 'e2e-refresh-token',
        user: {
          id: 'admin-e2e',
          nombre: 'Admin E2E',
          email: 'admin@envio.test',
          rol: 'ADMIN',
          activo: true,
          creadoEn: '2026-11-23T12:00:00.000Z',
        },
      }),
    });
  });
  await page.context().route('**/api/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 14,
        porEstado: {
          REGISTRADO: 2,
          ASIGNADO: 3,
          EN_RUTA: 1,
          ENTREGADO: 7,
          FALLIDO: 1,
        },
        requierenRevision: 4,
        porRepartidor: [],
        entregadosPorDia: [{ fecha: '2026-11-23', total: 7 }],
      }),
    });
  });

  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@envio.test');
  await page.locator('input[type="password"]').fill('cambiar123');
  await page.getByRole('button', { name: 'AUTENTICAR EN CONSOLA' }).click();
  await page.goto('/stats');

  await expect(page.getByRole('heading', { name: 'Métricas de envíos' })).toBeVisible();
  await expect(page.getByText('Total de paquetes')).toBeVisible();
  await expect(page.getByText('14', { exact: true })).toBeVisible();
  await expect(page.getByText('Requieren revisión')).toBeVisible();
  await expect(page.getByText('4', { exact: true })).toBeVisible();
  await expect(page.getByText('Entregados', { exact: true }).first()).toBeVisible();
});
