/**
 * Display formatting only (spec §2, §10.2): en-GB, GBP, Europe/London. Canonical values stay in
 * data-value attributes; nothing is computed from these strings.
 */
const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const LONDON = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/London',
});

export const money = (value: string): string => GBP.format(Number(value));
export const percent = (value: string): string => `${value}%`;
export const londonTime = (iso: string | null): string => (iso ? LONDON.format(new Date(iso)) : '—');

/** Plain-language text for §7.2 codes shown when an action is unavailable or refused. */
export const REASON_TEXT: Record<string, string> = {
    UNAUTHENTICATED: 'You need to sign in.',
    ROLE_NOT_PERMITTED: 'Your role does not permit this.',
    INVALID_STATE: 'Not possible in the application’s current status.',
    NOT_APPLICATION_OWNER: 'Only the member of staff who created the application can do this.',
    SELF_APPROVAL: 'You created this application, so a colleague must decide it.',
    REFERRAL_AUTHORITY: 'Referred applications are decided by a senior underwriter.',
    LIMIT_EXCEEDED: 'The amount exceeds your approval limit.',
    REVIEW_NOT_AVAILABLE: 'A human review is not available for this decision.',
    REVIEW_WINDOW_CLOSED: 'The 30-day window for a human review has closed.',
    AMOUNT_OUT_OF_RANGE: 'The amount must be between £1,000.00 and £25,000.00.',
    TERM_OUT_OF_RANGE: 'The term must be between 12 and 60 months.',
    INVALID_MONEY: 'Enter money as a number with up to two decimal places.',
    REASON_REQUIRED: 'Enter a reason.',
    NOT_FOUND: 'Not found.',
};

export const reasonText = (code: string): string => REASON_TEXT[code] ?? 'Something went wrong.';

/** The refusal code of an unavailable action, or '' when it is available. */
export const reasonOf = (a: { available: boolean; reason?: string }): string => (a.available ? '' : (a.reason ?? ''));
