import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';
import {
  LoginDto,
  UserDto,
  AuthResponseDto,
  RefreshResponseDto,
} from './auth.dto';
import { AuthUserPayload } from '../../types/express';

export class AuthService {
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private generateOpaqueToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  private generateAccessToken(user: { id: string; email: string; rol: User['rol'] }): string {
    const payload: AuthUserPayload = {
      id: user.id,
      email: user.email,
      rol: user.rol,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  private sanitizeUser(user: User): UserDto {
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      activo: user.activo,
      creadoEn: user.creadoEn,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw AppError.unauthenticated('Credenciales inválidas');
    }

    if (!user.activo) {
      throw AppError.unauthenticated('Usuario inactivo o suspendido');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw AppError.unauthenticated('Credenciales inválidas');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshTokenRaw = this.generateOpaqueToken();
    const tokenHash = this.hashToken(refreshTokenRaw);

    const expiraEn = new Date();
    expiraEn.setDate(expiraEn.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiraEn,
        revocado: false,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      user: this.sanitizeUser(user),
    };
  }

  async refresh(refreshTokenRaw: string): Promise<RefreshResponseDto> {
    const tokenHash = this.hashToken(refreshTokenRaw);

    const existingToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existingToken) {
      throw AppError.unauthenticated('Refresh token inválido o no encontrado');
    }

    // Detección de reuso de token revocado (seguridad estricta):
    // Si alguien intenta usar un token revocado, se revocan TODOS los tokens del usuario
    if (existingToken.revocado) {
      await prisma.refreshToken.updateMany({
        where: { userId: existingToken.userId },
        data: { revocado: true },
      });
      throw AppError.unauthenticated('Refresh token revocado. Sesión invalidada por motivos de seguridad');
    }

    if (existingToken.expiraEn < new Date()) {
      throw AppError.unauthenticated('Refresh token expirado');
    }

    if (!existingToken.user.activo) {
      throw AppError.unauthenticated('Usuario inactivo o suspendido');
    }

    // Rotación: revocar el token actual y generar uno nuevo
    const newRefreshTokenRaw = this.generateOpaqueToken();
    const newTokenHash = this.hashToken(newRefreshTokenRaw);

    const newExpiraEn = new Date();
    newExpiraEn.setDate(newExpiraEn.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: existingToken.id },
        data: { revocado: true },
      }),
      prisma.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          userId: existingToken.userId,
          expiraEn: newExpiraEn,
          revocado: false,
        },
      }),
    ]);

    const newAccessToken = this.generateAccessToken(existingToken.user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenRaw,
    };
  }

  async logout(userId: string, refreshTokenRaw: string): Promise<void> {
    const tokenHash = this.hashToken(refreshTokenRaw);

    const token = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        userId,
      },
    });

    if (token && !token.revocado) {
      await prisma.refreshToken.update({
        where: { id: token.id },
        data: { revocado: true },
      });
    }
  }

  async getMe(userId: string): Promise<UserDto> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.activo) {
      throw AppError.unauthenticated('Usuario no encontrado o inactivo');
    }

    return this.sanitizeUser(user);
  }
}
