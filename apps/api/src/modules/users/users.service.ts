import bcrypt from 'bcryptjs';
import { User, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../errors/app-error';
import { UserDto } from '../auth/auth.dto';
import {
  CreateUserDto,
  UpdateUserDto,
  GetUsersQueryDto,
  PaginatedUsersResponseDto,
} from './users.dto';

export class UsersService {
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

  async getUsers(query: GetUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    const { rol, activo, page = 1, pageSize = 20 } = query;

    const where: Prisma.UserWhereInput = {};
    if (rol !== undefined) {
      where.rol = rol;
    }
    if (activo !== undefined) {
      where.activo = activo;
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { creadoEn: 'desc' },
      }),
    ]);

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      page,
      pageSize,
      total,
    };
  }

  async getUserById(id: string): Promise<UserDto> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw AppError.notFound('Usuario no encontrado');
    }

    return this.sanitizeUser(user);
  }

  async createUser(dto: CreateUserDto): Promise<UserDto> {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw AppError.conflict('Ya existe un usuario registrado con este correo electrónico');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const newUser = await prisma.user.create({
      data: {
        nombre: dto.nombre,
        email: dto.email.toLowerCase(),
        passwordHash,
        rol: dto.rol,
        activo: true,
      },
    });

    return this.sanitizeUser(newUser);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw AppError.notFound('Usuario no encontrado');
    }

    // Si se modifica el email, verificar unicidad
    if (dto.email && dto.email.toLowerCase() !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (emailInUse) {
        throw AppError.conflict('El nuevo correo electrónico ya se encuentra registrado por otro usuario');
      }
    }

    // Regla de negocio del contrato:
    // "Desactivar a un repartidor con paquetes activos (ASIGNADO o EN_RUTA) -> 409 hasta reasignarlos"
    if (dto.activo === false && existingUser.rol === 'REPARTIDOR') {
      const activePackagesCount = await prisma.package.count({
        where: {
          repartidorId: id,
          estado: {
            in: ['ASIGNADO', 'EN_RUTA'],
          },
        },
      });

      if (activePackagesCount > 0) {
        throw AppError.conflict(
          `No se puede desactivar al repartidor porque tiene ${activePackagesCount} paquete(s) activo(s) asignado(s) o en ruta. Reasigne los paquetes primero.`
        );
      }
    }

    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (dto.nombre !== undefined) dataToUpdate.nombre = dto.nombre;
    if (dto.email !== undefined) dataToUpdate.email = dto.email.toLowerCase();
    if (dto.activo !== undefined) dataToUpdate.activo = dto.activo;
    if (dto.password !== undefined) {
      dataToUpdate.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    return this.sanitizeUser(updatedUser);
  }
}
