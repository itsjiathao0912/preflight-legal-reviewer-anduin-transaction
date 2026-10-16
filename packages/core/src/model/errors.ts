import type { ErrorCode } from '../contracts/errors';

/** Typed error thrown by core boundaries (adapter caps, quote caps, cookie size). */
export class CoreError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'CoreError';
    this.code = code;
  }
}
