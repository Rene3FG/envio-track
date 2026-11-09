import { Role } from '@prisma/client';

export interface AuthUserPayload {
  id: string;
  email: string;
  rol: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
