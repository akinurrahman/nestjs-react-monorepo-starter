import type { User } from './generated/prisma/client.js';

export interface SeedOutcome {
  level: 'log' | 'warn' | 'error';
  message: string;
}

// What the seed reports when SEED_ADMIN_EMAIL already belongs to a user. The
// seed never changes an existing user, so this only decides how loud it is:
// a failure only when the app is left with no active admin at all.
export function existingUserOutcome(
  user: Pick<User, 'role' | 'isActive'>,
  hasActiveAdmin: boolean,
): SeedOutcome {
  const isAdmin = user.role === 'ADMIN';
  if (isAdmin && user.isActive) {
    return {
      level: 'log',
      message: 'Admin user already exists, nothing to do',
    };
  }

  const state = [!isAdmin && 'is not an admin', !user.isActive && 'is disabled']
    .filter(Boolean)
    .join(' and ');
  const leftAsIs = `The user with SEED_ADMIN_EMAIL ${state}, and the seed leaves existing users as they are.`;
  return hasActiveAdmin
    ? { level: 'warn', message: `${leftAsIs} Another active admin exists.` }
    : {
        level: 'error',
        message: `${leftAsIs} No admin was created and no active admin exists: set another SEED_ADMIN_EMAIL, or make that user an active admin in the database.`,
      };
}
