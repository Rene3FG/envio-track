import { Request, Response, NextFunction } from 'express';
import { PackagesService } from './packages.service';
import {
  CreatePackageDto,
  UpdatePackageDto,
  AssignPackageDto,
  GetPackagesQueryDto,
} from './packages.dto';
import { AppError } from '../../errors/app-error';

export class PackagesController {
  constructor(private readonly packagesService: PackagesService = new PackagesService()) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthenticated();
      const query = req.query as unknown as GetPackagesQueryDto;
      const result = await this.packagesService.getPackages(req.user, query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthenticated();
      const { id } = req.params;
      const result = await this.packagesService.getPackageById(id, req.user);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthenticated();
      const dto: CreatePackageDto = req.body;
      const result = await this.packagesService.createPackage(req.user.id, dto);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const dto: UpdatePackageDto = req.body;
      const result = await this.packagesService.updatePackage(id, dto);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthenticated();
      const { id } = req.params;
      const { repartidorId }: AssignPackageDto = req.body;
      const result = await this.packagesService.assignPackage(id, repartidorId, req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getMineRoute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthenticated();
      const result = await this.packagesService.getMineRoute(req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
