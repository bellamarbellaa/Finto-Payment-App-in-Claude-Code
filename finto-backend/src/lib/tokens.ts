import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { ApiError } from './errors.js';
import { randomToken, sha256 } from './crypto.js';

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  /** 'full' after password login; 'pin' after a PIN unlock on a known device. */
  scope: 'full' | 'pin';
  typ: 'access';
}

export function signAccessToken(claims: Omit<AccessTokenClaims, 'typ'>): string {
  return jwt.sign({ ...claims, typ: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: 'finto',
    audience: 'finto-clients'
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'finto',
      audience: 'finto-clients'
    }) as AccessTokenClaims;

    if (decoded.typ !== 'access') throw new Error('wrong token type');
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Your session expired. Refresh and try again.', 'token_expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }
}

/**
 * Refresh tokens are opaque random strings, not JWTs. They live in the
 * sessions table, so a stolen token can be revoked the moment it is noticed —
 * something a self-contained JWT cannot offer.
 */
export function issueRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomToken(48);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash: sha256(token), expiresAt };
}

export function hashRefreshToken(token: string): string {
  return sha256(token);
}

export const REFRESH_COOKIE = 'finto_refresh';

/**
 * Desktop web gets the refresh token in an httpOnly cookie so page scripts
 * cannot read it. Native mobile gets it in the JSON body and stores it in the
 * platform keychain. Same endpoint, both clients.
 */
export const refreshCookieOptions = {
  httpOnly: true,
  // SameSite=None is meaningless without Secure, and browsers drop such
  // cookies outright — so asking for 'none' forces Secure on.
  secure: env.COOKIE_SECURE || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  path: '/v1/auth',
  domain: env.COOKIE_DOMAIN || undefined,
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60
};
