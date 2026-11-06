import type { z } from 'zod';
import * as s from './schemas';

export type Role = z.infer<typeof s.RoleSchema>;
export type PackageStatus = z.infer<typeof s.PackageStatusSchema>;
export type EventType = z.infer<typeof s.EventTypeSchema>;
export type SyncEventType = z.infer<typeof s.SyncEventTypeSchema>;

export type ErrorResponse = z.infer<typeof s.ErrorResponseSchema>;
export type UserDto = z.infer<typeof s.UserDtoSchema>;
export type LoginDto = z.infer<typeof s.LoginDtoSchema>;
export type RefreshDto = z.infer<typeof s.RefreshDtoSchema>;
export type LoginResponse = z.infer<typeof s.LoginResponseSchema>;
export type TokenPair = z.infer<typeof s.TokenPairSchema>;
export type CreateUserDto = z.infer<typeof s.CreateUserDtoSchema>;
export type UpdateUserDto = z.infer<typeof s.UpdateUserDtoSchema>;
export type UserListQuery = z.infer<typeof s.UserListQuerySchema>;

export type PackageEventDto = z.infer<typeof s.PackageEventDtoSchema>;
export type PackageDto = z.infer<typeof s.PackageDtoSchema>;
export type PackageDetailDto = z.infer<typeof s.PackageDetailDtoSchema>;
export type CreatePackageDto = z.infer<typeof s.CreatePackageDtoSchema>;
export type UpdatePackageDto = z.infer<typeof s.UpdatePackageDtoSchema>;
export type AssignPackageDto = z.infer<typeof s.AssignPackageDtoSchema>;
export type PackageListQuery = z.infer<typeof s.PackageListQuerySchema>;

export type SyncEventDto = z.infer<typeof s.SyncEventDtoSchema>;
export type SyncRequest = z.infer<typeof s.SyncRequestSchema>;
export type SyncStatus = z.infer<typeof s.SyncStatusSchema>;
export type SyncResult = z.infer<typeof s.SyncResultSchema>;
export type SyncResponse = z.infer<typeof s.SyncResponseSchema>;

export type TrackDto = z.infer<typeof s.TrackDtoSchema>;
export type StatsQuery = z.infer<typeof s.StatsQuerySchema>;
export type StatsDto = z.infer<typeof s.StatsDtoSchema>;
export type Paginated<T> = { data: T[]; page: number; pageSize: number; total: number };
