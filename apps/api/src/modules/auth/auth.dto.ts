import { z } from 'zod';
import { Role } from '@prisma/client';

export const loginSchema = z.object({
  email: z.string().trim().email('El correo electrónico no tiene un formato válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'El refreshToken es requerido'),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'El refreshToken es requerido'),
});

export type LogoutDto = z.infer<typeof logoutSchema>;

export interface UserDto {
  id: string;
  nombre: string;
  email: string;
  rol: Role;
  activo: boolean;
  creadoEn: Date;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface RefreshResponseDto {
  accessToken: string;
  refreshToken: string;
}
