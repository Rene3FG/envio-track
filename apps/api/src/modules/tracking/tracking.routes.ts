import { Router } from 'express';
import { TrackingController } from './tracking.controller';

const router = Router();
const controller = new TrackingController();

// GET /api/track/:guia - Público (sin login)
router.get('/:guia', controller.track);

export const trackingRouter = router;
