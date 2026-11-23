import { z } from 'zod';
import { Role } from '@prisma/client';
import { UserDto } from '../auth/auth.dto';

export const createUserSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().trim().email('El correo electrónico no tiene un formato válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rol: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'El rol debe ser ADMIN o REPARTIDOR' }),
  }),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  email: z.string().trim().email('El correo electrónico no tiene un formato válido').optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  activo: z.boolean().optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const getUsersQuerySchema = z.object({
  rol: z.nativeEnum(Role).optional(),
  activo: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20)),
});

export type GetUsersQueryDto = z.infer<typeof getUsersQuerySchema>;

export interface PaginatedUsersResponseDto {
  data: UserDto[];
  page: number;
  pageSize: number;
  total: number;
}
