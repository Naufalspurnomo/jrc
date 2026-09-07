import { Role } from '@prisma/client';

export function roleAllows(actual: Role, required: readonly Role[]): boolean {
  return required.length === 0 || actual === Role.SUPER_ADMIN || required.includes(actual);
}