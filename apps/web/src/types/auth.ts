export type UserRole = 'ADMIN' | 'REPARTIDOR';

export interface UserDto {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  activo: boolean;
  creadoEn: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}
