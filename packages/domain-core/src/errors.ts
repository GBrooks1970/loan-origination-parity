import type { DenialCode, ValidationCode } from './types.js';

export type DomainErrorCode = DenialCode | ValidationCode | 'NOT_FOUND';

/** A refused command or invalid request. Transports map `code` to HTTP (see httpStatusFor). */
export class DomainError extends Error {
    constructor(
        public readonly code: DomainErrorCode,
        message: string = code,
    ) {
        super(message);
        this.name = 'DomainError';
    }
}

/** Spec §7.2 and §4.3. */
export function httpStatusFor(code: DomainErrorCode): number {
    switch (code) {
        case 'UNAUTHENTICATED':
            return 401;
        case 'NOT_FOUND':
            return 404;
        case 'INVALID_STATE':
        case 'REVIEW_NOT_AVAILABLE':
        case 'REVIEW_WINDOW_CLOSED':
            return 409;
        case 'AMOUNT_OUT_OF_RANGE':
        case 'TERM_OUT_OF_RANGE':
        case 'INVALID_MONEY':
        case 'REASON_REQUIRED':
            return 422;
        default:
            return 403;
    }
}
