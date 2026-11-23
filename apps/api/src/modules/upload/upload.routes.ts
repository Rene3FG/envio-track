import { Router } from 'express';
import { UploadController } from './upload.controller';
import { uploadFotoMiddleware } from './upload.middleware';
import { authenticateJwt } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new UploadController();

// POST /api/upload - Autenticado para ADMIN y REPARTIDOR
router.post('/', authenticateJwt, uploadFotoMiddleware, controller.uploadFoto);

export const uploadRouter = router;
