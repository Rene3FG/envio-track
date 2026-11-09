import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, LogoutDto } from './auth.dto';
import { AppError } from '../../errors/app-error';

export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto: LoginDto = req.body;
      const result = await this.authService.login(dto);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto: RefreshTokenDto = req.body;
      const result = await this.authService.refresh(dto.refreshToken);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthenticated();
      }
      const dto: LogoutDto = req.body;
      await this.authService.logout(req.user.id, dto.refreshToken);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthenticated();
      }
      const user = await this.authService.getMe(req.user.id);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  };
}
