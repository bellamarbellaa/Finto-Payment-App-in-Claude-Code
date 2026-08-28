/** Shapes returned by the Finto API. Kept in one place so both clients agree. */

export interface Money {
  amount: string;
  amountMinor: string;
  currency: string;
  formatted: string;
  symbol: string;
}

export interface PublicUser {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  displayName: string;
  handle: string;
  tint: string;
  baseCurrency: string;
  initials: string;
  security: { biometricEnabled: boolean; confirmPayments: boolean; pinSet: boolean };
  emailVerified: boolean;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  currency: string;
  symbol: string;
  kind: 'main' | 'balance' | 'savings';
  ibanMasked: string;
  isPrimary: boolean;
  status: 'active' | 'frozen' | 'closed';
  balance: Money;
  available: Money;
  createdAt: string;
}

export interface Transaction {
  id: string;
  reference: string;
  type: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  direction: 'in' | 'out';
  counterparty: { name: string; handle: string | null; initial: string; tint: string };
  category: string;
  note: string | null;
  failureReason: string | null;
  amount: Money;
  display: {
    amount: string;
    amountColor: string;
    meta: string;
    showStatus: boolean;
    statusLabel: string;
    statusBg: string;
    statusFg: string;
  };
  cardId: string | null;
  occurredAt: string;
  settledAt: string | null;
}

export interface TransactionGroup {
  key: string;
  label: string;
  total: string;
  currency: string;
  items: Transaction[];
}

export interface Contact {
  id: string;
  name: string;
  handle: string;
  firstName: string;
  initials: string;
  tint: string;
  isFavourite: boolean;
  isFintoUser: boolean;
  lastPaidAt: string | null;
}

export interface Card {
  id: string;
  brand: string;
  kind: 'virtual' | 'physical';
  last4: string;
  maskedNumber: string;
  expiry: string;
  holderName: string;
  state: 'active' | 'frozen' | 'terminated';
  accountId: string;
  controls: {
    onlinePayments: boolean;
    paymentsAbroad: boolean;
    contactless: boolean;
    atmWithdrawals: boolean;
    monthlyLimit: Money | null;
  };
  spending?: { thisMonth: Money; limitUsedPercent: number | null };
  createdAt: string;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  glyph: string;
  tint: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  timeAgo: string;
}

export interface PaymentRequest {
  id: string;
  amount: Money;
  note: string | null;
  status: 'pending' | 'paid' | 'declined' | 'cancelled' | 'expired';
  linkToken: string;
  shareUrl: string;
  deepLink: string;
  expiresAt: string;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
}

export type ErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'account_locked'
  | 'token_expired'
  | 'token_reused'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'insufficient_funds'
  | 'account_frozen'
  | 'card_frozen'
  | 'card_control_blocked'
  | 'limit_exceeded'
  | 'currency_unsupported'
  | 'idempotency_conflict'
  | 'request_expired'
  | 'rate_limited'
  | 'internal_error';

export interface RealtimeEvent {
  type:
    | 'connected'
    | 'transaction.created'
    | 'transaction.updated'
    | 'account.balance_changed'
    | 'notification.created'
    | 'card.updated'
    | 'payment_request.updated'
    | 'session.revoked';
  data: unknown;
  at: string;
}
