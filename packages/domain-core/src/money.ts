import { Decimal } from 'decimal.js';

import { DomainError } from './errors.js';

/** Independent Decimal constructor so no other package's global configuration can affect ours. */
export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export type Dec = InstanceType<typeof Dec>;

const MONEY = /^\d+(\.\d{1,2})?$/;

/** Parses a non-negative money string with at most two decimal places (spec §4.3). */
export function parseMoney(value: string): Dec {
    if (typeof value !== 'string' || !MONEY.test(value)) {
        throw new DomainError('INVALID_MONEY', `Not a valid money value: ${String(value)}`);
    }
    return new Dec(value);
}

export function formatMoney(value: Dec): string {
    return value.toFixed(2, Dec.ROUND_HALF_EVEN);
}

/** Half-even to two places (DR-008). */
export function roundHalfEven2(value: Dec): Dec {
    return value.toDecimalPlaces(2, Dec.ROUND_HALF_EVEN);
}
