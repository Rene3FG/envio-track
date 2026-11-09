import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateBody } from '../../middlewares/validate';
import { authenticateJwt } from '../../middlewares/auth.middleware';
import { loginSchema, refreshTokenSchema, logoutSchema } from './auth.dto';

const router = Router();
const controller = new AuthController();

// Rutas públicas
router.post('/login', validateBody(loginSchema), controller.login);
router.post('/refresh', validateBody(refreshTokenSchema), controller.refresh);

// Rutas protegidas
router.post('/logout', authenticateJwt, validateBody(logoutSchema), controller.logout);
router.get('/me', authenticateJwt, controller.getMe);

export const authRouter = router;
