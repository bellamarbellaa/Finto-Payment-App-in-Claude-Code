/**
 * Every failure the clients can act on has a stable machine code. The mobile
 * app and the web app both switch on `error.code`, never on the message text.
 */
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

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'validation_error', message, details);
  }
  static unauthorized(message = 'Authentication required', code: ErrorCode = 'unauthorized') {
    return new ApiError(401, code, message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, 'forbidden', message);
  }
  static notFound(what = 'Resource') {
    return new ApiError(404, 'not_found', `${what} not found`);
  }
  static conflict(message: string, code: ErrorCode = 'conflict', details?: unknown) {
    return new ApiError(409, code, message, details);
  }
  static unprocessable(code: ErrorCode, message: string, details?: unknown) {
    return new ApiError(422, code, message, details);
  }
  static internal(message = 'Something went wrong on our side') {
    return new ApiError(500, 'internal_error', message);
  }
}
