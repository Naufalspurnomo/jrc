import type { Role } from '@prisma/client';

type UserForSerialization = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  [key: string]: unknown;
};

export function serializeUser(user: UserForSerialization) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}