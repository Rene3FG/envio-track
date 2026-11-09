import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../errors/app-error';

export class UploadController {
  uploadFoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw AppError.badRequest("El archivo con el campo 'foto' es requerido");
      }

      res.status(201).json({
        fotoUrl: `/uploads/${req.file.filename}`,
      });
    } catch (err) {
      next(err);
    }
  };
}
