import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticateJwt, requireRole } from '../../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../../middlewares/validate';
import { createUserSchema, updateUserSchema, getUsersQuerySchema } from './users.dto';

const router = Router();
const controller = new UsersController();

// Todas las rutas de gestión de usuarios requieren autenticación y rol ADMIN
router.use(authenticateJwt);
router.use(requireRole('ADMIN'));

router.get('/', validateQuery(getUsersQuerySchema), controller.getAll);
router.get('/:id', controller.getById);
router.post('/', validateBody(createUserSchema), controller.create);
router.patch('/:id', validateBody(updateUserSchema), controller.update);

export const usersRouter = router;
