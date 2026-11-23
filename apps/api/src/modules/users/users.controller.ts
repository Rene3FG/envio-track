import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, GetUsersQueryDto } from './users.dto';

export class UsersController {
  constructor(private readonly usersService: UsersService = new UsersService()) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as GetUsersQueryDto;
      const result = await this.usersService.getUsers(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.usersService.getUserById(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto: CreateUserDto = req.body;
      const result = await this.usersService.createUser(dto);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const dto: UpdateUserDto = req.body;
      const result = await this.usersService.updateUser(id, dto);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
