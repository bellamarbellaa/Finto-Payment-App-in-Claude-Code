import type { User } from '../../db/schema.js';

/** The only shape of a user that ever leaves the API. */
export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    displayName: user.displayName,
    handle: user.handle,
    tint: user.tint,
    baseCurrency: user.baseCurrency,
    initials: initialsOf(user.fullName),
    security: {
      biometricEnabled: user.biometricEnabled,
      confirmPayments: user.confirmPayments,
      pinSet: Boolean(user.pinHash)
    },
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt
  };
}

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + second).toUpperCase();
}
