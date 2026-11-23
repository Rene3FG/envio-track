import { Request, Response, NextFunction } from 'express';
import { TrackingService } from './tracking.service';

export class TrackingController {
  constructor(private readonly trackingService: TrackingService = new TrackingService()) {}

  track = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { guia } = req.params;
      const result = await this.trackingService.trackByGuia(guia);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
