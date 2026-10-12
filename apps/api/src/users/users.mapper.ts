import type { PublicUser } from '@starter/shared';
import type { User } from '../generated/prisma/client.js';

// Lists the public fields one by one, so a column added to the model (or the
// password hash) never reaches a response by accident.
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),  };
}
