import { Request, Response, NextFunction } from 'express';
import { StatsService } from './stats.service';
import { StatsQueryDto } from './stats.dto';

export class StatsController {
  constructor(private readonly statsService: StatsService = new StatsService()) {}

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as StatsQueryDto;
      const result = await this.statsService.getStats(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
