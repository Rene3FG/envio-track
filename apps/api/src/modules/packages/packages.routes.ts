import { Router } from 'express';
import { PackagesController } from './packages.controller';
import { authenticateJwt, requireRole } from '../../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../../middlewares/validate';
import {
  createPackageSchema,
  updatePackageSchema,
  assignPackageSchema,
  getPackagesQuerySchema,
} from './packages.dto';

const router = Router();
const controller = new PackagesController();

// Todas las rutas de paquetes requieren autenticación
router.use(authenticateJwt);

// Ruta específica para repartidores: debe ir antes de `/:id`
router.get('/mine/route', requireRole('REPARTIDOR'), controller.getMineRoute);

// Consultar paquetes con filtros (ADMIN ve todos, REPARTIDOR solo los suyos)
router.get('/', validateQuery(getPackagesQuerySchema), controller.getAll);

// Detalle de un paquete con su historial de eventos
router.get('/:id', controller.getById);

// Rutas de administración (ADMIN)
router.post('/', requireRole('ADMIN'), validateBody(createPackageSchema), controller.create);
router.patch('/:id', requireRole('ADMIN'), validateBody(updatePackageSchema), controller.update);
router.post(
  '/:id/assignment',
  requireRole('ADMIN'),
  validateBody(assignPackageSchema),
  controller.assign
);

export const packagesRouter = router;
