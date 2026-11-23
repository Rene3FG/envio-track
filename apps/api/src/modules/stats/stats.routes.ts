import { Router } from 'express';
import { StatsController } from './stats.controller';
import { authenticateJwt, requireRole } from '../../middlewares/auth.middleware';
import { validateQuery } from '../../middlewares/validate';
import { statsQuerySchema } from './stats.dto';

const router = Router();
const controller = new StatsController();

// GET /api/stats - Requiere autenticación y rol ADMIN
router.use(authenticateJwt);
router.use(requireRole('ADMIN'));

router.get('/', validateQuery(statsQuerySchema), controller.getStats);

export const statsRouter = router;
