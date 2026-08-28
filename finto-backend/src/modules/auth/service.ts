import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { auditLog, devices, sessions, users, accounts } from '../../db/schema.js';
import { hashSecret, verifySecret } from '../../lib/crypto.js';
import { hashRefreshToken, issueRefreshToken, signAccessToken } from '../../lib/tokens.js';
import { ApiError } from '../../lib/errors.js';
import { publish } from '../../realtime/hub.js';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
  device?: { name: string; platform: 'ios' | 'android' | 'web'; pushToken?: string };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
}

async function createSession(
  userId: string,
  scope: 'full' | 'pin',
  client: ClientInfo
): Promise<TokenPair> {
  let deviceId: string | null = null;

  if (client.device) {
    const [device] = await db
      .insert(devices)
      .values({
        userId,
        name: client.device.name.slice(0, 80),
        platform: client.device.platform,
        pushToken: client.device.pushToken ?? null,
        lastIp: client.ip ?? null
      })
      .returning({ id: devices.id });
    deviceId = device?.id ?? null;
  }

  const refresh = issueRefreshToken();

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      deviceId,
      tokenHash: refresh.hash,
      userAgent: client.userAgent ?? null,
      ip: client.ip ?? null,
      expiresAt: refresh.expiresAt
    })
    .returning({ id: sessions.id });

  if (!session) throw ApiError.internal('Could not start a session');

  return {
    accessToken: signAccessToken({ sub: userId, sid: session.id, scope }),
    refreshToken: refresh.token,
    expiresIn: 15 * 60,
    sessionId: session.id
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  handle?: string;
  phone?: string;
  baseCurrency?: string;
}

export async function register(input: RegisterInput, client: ClientInfo) {
  const email = input.email.trim().toLowerCase();
  const handle = (input.handle ?? '@' + email.split('@')[0]).toLowerCase().slice(0, 40);

  const existing = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${email}`,
    columns: { id: true }
  });

  if (existing) {
    // Deliberately not "that email is taken" — that would confirm who banks here.
    throw ApiError.conflict('We could not create that account. Try signing in instead.');
  }

  const passwordHash = await hashSecret(input.password);
  const displayName = input.fullName.trim().split(/\s+/)[0] ?? input.fullName;
  const currency = (input.baseCurrency ?? 'USD').toUpperCase();

  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email,
        fullName: input.fullName.trim(),
        displayName,
        handle,
        phone: input.phone ?? null,
        passwordHash,
        baseCurrency: currency
      })
      .returning();

    if (!created) throw ApiError.internal('Could not create your account');

    // Every user starts with a primary account in their base currency.
    await tx.insert(accounts).values({
      userId: created.id,
      name: `Main · ${currency}`,
      currency,
      kind: 'main',
      ibanMasked: maskedIban(currency),
      isPrimary: true
    });

    return created;
  });

  const tokens = await createSession(user.id, 'full', client);
  await audit(user.id, 'auth.register', client);

  return { user, tokens };
}

export async function login(
  identifier: string,
  password: string,
  client: ClientInfo
) {
  const value = identifier.trim().toLowerCase();

  const user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${value} OR ${users.phone} = ${identifier.trim()} OR lower(${users.handle}) = ${value}`
  });

  // Hash a dummy password when the user is unknown, so a missing account and a
  // wrong password take the same time to answer.
  if (!user) {
    await verifySecret(password, 'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA');
    throw ApiError.unauthorized('That email or password is not right.', 'invalid_credentials');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw ApiError.unauthorized(
      `Too many attempts. Try again after ${user.lockedUntil.toLocaleTimeString()}.`,
      'account_locked'
    );
  }

  const ok = await verifySecret(password, user.passwordHash);

  if (!ok) {
    const failed = user.failedLoginCount + 1;
    await db
      .update(users)
      .set({
        failedLoginCount: failed,
        lockedUntil:
          failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null
      })
      .where(eq(users.id, user.id));

    await audit(user.id, 'auth.login_failed', client);
    throw ApiError.unauthorized('That email or password is not right.', 'invalid_credentials');
  }

  if (user.status !== 'active') {
    throw ApiError.forbidden('This account is not active. Contact support.');
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const tokens = await createSession(user.id, 'full', client);
  await audit(user.id, 'auth.login', client);

  return { user, tokens };
}

/**
 * Rotate a refresh token. The old row is revoked and points at its successor,
 * so presenting an already-rotated token means the token leaked — every
 * session for that user is killed rather than quietly issuing a new pair.
 */
export async function refresh(rawToken: string, client: ClientInfo): Promise<TokenPair> {
  const tokenHash = hashRefreshToken(rawToken);

  const existing = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, tokenHash)
  });

  if (!existing) throw ApiError.unauthorized('Please sign in again.');

  if (existing.revokedAt) {
    await revokeAllSessions(existing.userId);
    publish(existing.userId, { type: 'session.revoked', data: { reason: 'token_reuse' } });
    await audit(existing.userId, 'auth.refresh_reuse_detected', client);
    throw ApiError.unauthorized(
      'For your security we signed you out everywhere. Please sign in again.',
      'token_reused'
    );
  }

  if (existing.expiresAt <= new Date()) {
    throw ApiError.unauthorized('Please sign in again.', 'token_expired');
  }

  const next = issueRefreshToken();

  const pair = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(sessions)
      .values({
        userId: existing.userId,
        deviceId: existing.deviceId,
        tokenHash: next.hash,
        userAgent: client.userAgent ?? existing.userAgent,
        ip: client.ip ?? existing.ip,
        expiresAt: next.expiresAt
      })
      .returning({ id: sessions.id });

    if (!created) throw ApiError.internal('Could not refresh your session');

    await tx
      .update(sessions)
      .set({ revokedAt: new Date(), replacedBySessionId: created.id })
      .where(eq(sessions.id, existing.id));

    return created;
  });

  return {
    accessToken: signAccessToken({ sub: existing.userId, sid: pair.id, scope: 'full' }),
    refreshToken: next.token,
    expiresIn: 15 * 60,
    sessionId: pair.id
  };
}

export async function logout(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        exceptSessionId ? sql`${sessions.id} <> ${exceptSessionId}` : undefined
      )
    )
    .returning({ id: sessions.id });

  return result.length;
}

export async function listSessions(userId: string) {
  return db.query.sessions.findMany({
    where: and(eq(sessions.userId, userId), isNull(sessions.revokedAt)),
    columns: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true },
    orderBy: (s, { desc }) => [desc(s.createdAt)]
  });
}

/* ------------------------------------------------------------- PIN unlock */

export async function setPin(userId: string, pin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) throw ApiError.badRequest('Your PIN must be 4 to 8 digits');
  if (/^(\d)\1+$/.test(pin)) throw ApiError.badRequest('Choose a PIN that is not all the same digit');

  await db.update(users).set({ pinHash: await hashSecret(pin) }).where(eq(users.id, userId));
}

/**
 * Unlock with a PIN on a device that already holds a valid refresh token. The
 * resulting access token has 'pin' scope: enough to browse, not enough to move
 * money or change security settings without re-entering the password.
 */
export async function unlockWithPin(
  rawRefreshToken: string,
  pin: string,
  client: ClientInfo
): Promise<TokenPair> {
  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.tokenHash, hashRefreshToken(rawRefreshToken)), isNull(sessions.revokedAt))
  });

  if (!session || session.expiresAt <= new Date()) {
    throw ApiError.unauthorized('Please sign in again.');
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user?.pinHash) throw ApiError.badRequest('No PIN is set on this account');

  if (!(await verifySecret(pin, user.pinHash))) {
    await audit(user.id, 'auth.pin_failed', client);
    throw ApiError.unauthorized('That PIN is not right.', 'invalid_credentials');
  }

  return {
    accessToken: signAccessToken({ sub: user.id, sid: session.id, scope: 'pin' }),
    refreshToken: rawRefreshToken,
    expiresIn: 15 * 60,
    sessionId: session.id
  };
}

/* ---------------------------------------------------------------- helpers */

function maskedIban(currency: string): string {
  const country = { USD: 'US', EUR: 'DE', GBP: 'GB', CHF: 'CH', SEK: 'SE' }[currency] ?? 'XX';
  const tail = Math.floor(1000 + Math.random() * 9000);
  return `${country}** **** ${tail}`;
}

export async function audit(
  userId: string | null,
  action: string,
  client: ClientInfo,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await db.insert(auditLog).values({
    userId,
    action,
    ip: client.ip ?? null,
    userAgent: client.userAgent ?? null,
    metadata
  });
}
