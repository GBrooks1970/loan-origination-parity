import { DomainError } from './errors.js';
import { Dec, parseMoney } from './money.js';
import type { Application, Command, Money, Role, StaffMember } from './types.js';

/** Spec §7.1. Limits are inclusive. */
const APPROVAL_LIMIT: Record<Role, Money | null> = {
    LOAN_OFFICER: '10000.00',
    UNDERWRITER: '20000.00',
    SENIOR_UNDERWRITER: '25000.00',
    AUDITOR: null,
};

export function approvalLimitFor(role: Role): Money | null {
    return APPROVAL_LIMIT[role];
}

const ROLE_PERMITS: Record<Role, ReadonlySet<Command>> = {
    LOAN_OFFICER: new Set<Command>(['submit', 'approve', 'decline', 'withdraw', 'request human review', 'read']),
    UNDERWRITER: new Set<Command>(['submit', 'approve', 'decline', 'withdraw', 'request human review', 'read']),
    SENIOR_UNDERWRITER: new Set<Command>(['submit', 'approve', 'decline', 'withdraw', 'request human review', 'read']),
    AUDITOR: new Set<Command>(['read']),
};

const STATES_PERMITTING: Partial<Record<Command, ReadonlySet<Application['status']>>> = {
    approve: new Set(['AWAITING_APPROVAL', 'REFERRED']),
    decline: new Set(['AWAITING_APPROVAL', 'REFERRED']),
    withdraw: new Set(['AWAITING_APPROVAL', 'REFERRED']),
    'request human review': new Set(['DECLINED']),
};

/** Check 1. */
export function authenticate(staff: StaffMember | undefined): StaffMember {
    if (!staff) {
        throw new DomainError('UNAUTHENTICATED');
    }
    return staff;
}

/** Check 2. */
export function checkRole(actor: StaffMember, command: Command): void {
    if (!ROLE_PERMITS[actor.role].has(command)) {
        throw new DomainError('ROLE_NOT_PERMITTED');
    }
}

/**
 * Checks 3–9 for a command on an existing application, in the fixed order of spec §7.2,
 * so the first failure (and therefore every scenario's expected code) is deterministic.
 */
export function checkCommand(
    actor: StaffMember,
    command: Exclude<Command, 'submit' | 'read'>,
    application: Application,
    now: Date,
    reviewWindowEnds: Date | null,
): void {
    checkRole(actor, command);

    // Check 3
    if (!STATES_PERMITTING[command]?.has(application.status)) {
        throw new DomainError('INVALID_STATE');
    }

    // Check 4
    if (command === 'withdraw' && application.createdBy !== actor.username) {
        throw new DomainError('NOT_APPLICATION_OWNER');
    }

    if (command === 'approve' || command === 'decline') {
        // Check 5 — maker–checker
        if (application.createdBy === actor.username) {
            throw new DomainError('SELF_APPROVAL');
        }
        // Check 6 — referral authority
        if (application.status === 'REFERRED' && actor.role !== 'SENIOR_UNDERWRITER') {
            throw new DomainError('REFERRAL_AUTHORITY');
        }
        // Check 7 — amount limit
        const limit = actor.approvalLimit;
        if (limit === null || parseMoney(application.amount).greaterThan(new Dec(limit))) {
            throw new DomainError('LIMIT_EXCEEDED');
        }
    }

    if (command === 'request human review') {
        // Check 8
        if (application.decisionType !== 'AUTOMATED' || application.humanReviewRequested) {
            throw new DomainError('REVIEW_NOT_AVAILABLE');
        }
        // Check 9 — the window is inclusive (spec §6.3)
        if (reviewWindowEnds === null || now.getTime() > reviewWindowEnds.getTime()) {
            throw new DomainError('REVIEW_WINDOW_CLOSED');
        }
    }
}
