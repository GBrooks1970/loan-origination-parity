import { authenticate, checkCommand, checkRole } from './authorisation.js';
import { declineNoticeFor } from './decline-notice.js';
import { DomainError } from './errors.js';
import { Dec, parseMoney } from './money.js';
import type { Ports } from './ports.js';
import { RULE_SET_VERSION, evaluate } from './rules.js';
import { addDays } from './time.js';
import type {
    Application,
    AuditEvent,
    Command,
    DeclineNotice,
    NewApplication,
    StaffMember,
    Status,
} from './types.js';

const PRODUCT_MIN_AMOUNT = new Dec('1000.00');
const PRODUCT_MAX_AMOUNT = new Dec('25000.00');
const MIN_TERM = 12;
const MAX_TERM = 60;
const EXPIRY_DAYS = 30;
const REVIEW_WINDOW_DAYS = 30;
const SYSTEM_ACTOR = 'system';

type ApplicationCommand = Exclude<Command, 'submit' | 'read'>;

/**
 * The application service: the only place state changes and authorisation happen (spec §7.3).
 * `actor` is a username resolved against the staff directory on every call (DR-012);
 * `undefined` means no one is signed in.
 */
export class LoanOriginationService {
    constructor(private readonly ports: Ports) {}

    submit(actor: string | undefined, input: NewApplication): Application {
        const staff = authenticate(this.staffFor(actor));
        this.guard(staff, 'submit', null, () => checkRole(staff, 'submit'));
        validate(input);

        const now = this.ports.clock.now();
        const evaluation = evaluate({
            applicant: input.applicant,
            monthlyRepayment: input.monthlyRepayment,
            creditReferenceScore: this.ports.bureau.scoreFor(input.applicant.applicantRef),
            now,
        });

        const status: Status =
            evaluation.recommendation === 'ACCEPT'
                ? 'AWAITING_APPROVAL'
                : evaluation.recommendation === 'REFER'
                  ? 'REFERRED'
                  : 'DECLINED';
        const declined = status === 'DECLINED';

        const application: Application = {
            id: this.ports.applications.nextId(),
            applicant: structuredClone(input.applicant),
            status,
            decisionType: declined ? 'AUTOMATED' : null,
            recommendation: evaluation.recommendation,
            creditBand: evaluation.creditBand,
            debtServiceRatio: evaluation.debtServiceRatio,
            ruleResults: evaluation.ruleResults,
            declineReasons: evaluation.declineReasons,
            amount: parseMoney(input.amount).toFixed(2),
            termMonths: input.termMonths,
            monthlyRepayment: parseMoney(input.monthlyRepayment).toFixed(2),
            createdBy: staff.username,
            decidedBy: declined ? SYSTEM_ACTOR : null,
            submittedAt: now.toISOString(),
            decidedAt: declined ? now.toISOString() : null,
            humanReviewRequested: false,
            reopenedAt: null,
            ruleSetVersion: RULE_SET_VERSION,
        };
        this.ports.applications.save(application);

        this.record('APPLICATION_SUBMITTED', staff.username, application.id, {
            amount: application.amount,
            termMonths: application.termMonths,
            monthlyRepayment: application.monthlyRepayment,
            ruleSetVersion: RULE_SET_VERSION,
        });
        for (const result of evaluation.ruleResults) {
            this.record('RULE_EVALUATED', staff.username, application.id, { ...result });
        }
        this.record('STATUS_CHANGED', staff.username, application.id, { from: null, to: status });
        if (declined) {
            this.recordNotice(application);
        }
        return application;
    }

    approve(actor: string | undefined, id: string): Application {
        return this.transition(actor, id, 'approve', (app, staff, now) => ({
            ...app,
            status: 'APPROVED',
            decisionType: 'MANUAL',
            decidedBy: staff.username,
            decidedAt: now.toISOString(),
        }));
    }

    decline(actor: string | undefined, id: string, reason: string): Application {
        return this.transition(
            actor,
            id,
            'decline',
            (app, staff, now) => {
                // Validated after authorisation, like submission (spec §4.3).
                if (typeof reason !== 'string' || reason.trim().length === 0) {
                    throw new DomainError('REASON_REQUIRED', 'A decline reason is required');
                }
                return {
                ...app,
                status: 'DECLINED',
                decisionType: 'MANUAL',
                declineReasons: ['UNDERWRITER_DECISION'],
                decidedBy: staff.username,
                decidedAt: now.toISOString(),
                };
            },
            { reason },
        );
    }

    withdraw(actor: string | undefined, id: string): Application {
        return this.transition(actor, id, 'withdraw', (app) => ({ ...app, status: 'WITHDRAWN' }));
    }

    requestHumanReview(actor: string | undefined, id: string): Application {
        const updated = this.transition(actor, id, 'request human review', (app, _staff, now) => ({
            ...app,
            status: 'REFERRED',
            decisionType: null,
            humanReviewRequested: true,
            reopenedAt: now.toISOString(),
        }));
        this.record('HUMAN_REVIEW_REQUESTED', actor ?? SYSTEM_ACTOR, id, {});
        return updated;
    }

    get(actor: string | undefined, id: string): Application {
        this.readAs(actor);
        return this.load(id);
    }

    list(actor: string | undefined, status?: Status): Application[] {
        this.readAs(actor);
        return this.ports.applications
            .list()
            .map((app) => this.applyExpiry(app))
            .filter((app) => status === undefined || app.status === status);
    }

    auditTrail(actor: string | undefined, id: string): AuditEvent[] {
        this.readAs(actor);
        this.load(id);
        return this.ports.audit.forApplication(id);
    }

    declineNotice(actor: string | undefined, id: string): DeclineNotice {
        this.readAs(actor);
        const application = this.load(id);
        if (application.status !== 'DECLINED') {
            throw new DomainError('INVALID_STATE', 'Only a declined application has a decline notice');
        }
        return declineNoticeFor(application);
    }

    // --- internals -----------------------------------------------------------------------------

    private transition(
        actor: string | undefined,
        id: string,
        command: ApplicationCommand,
        apply: (app: Application, staff: StaffMember, now: Date) => Application,
        auditPayload: Record<string, unknown> = {},
    ): Application {
        const staff = authenticate(this.staffFor(actor));
        const application = this.load(id); // check 0: lazy expiry
        const now = this.ports.clock.now();
        const reviewWindowEnds = application.decidedAt
            ? addDays(new Date(application.decidedAt), REVIEW_WINDOW_DAYS)
            : null;

        this.guard(staff, command, application.id, () =>
            checkCommand(staff, command, application, now, reviewWindowEnds),
        );

        const updated = apply(application, staff, now);
        this.ports.applications.save(updated);
        this.record('STATUS_CHANGED', staff.username, id, {
            from: application.status,
            to: updated.status,
            command,
            ...auditPayload,
        });
        if (updated.status === 'DECLINED') {
            this.recordNotice(updated);
        }
        return updated;
    }

    /** Runs checks 2–9; a denial is audited and leaves the application unchanged (spec §7.2). */
    private guard(staff: StaffMember, command: Command, applicationId: string | null, check: () => void): void {
        try {
            check();
        } catch (error) {
            if (error instanceof DomainError) {
                this.record('AUTHORISATION_DENIED', staff.username, applicationId, { command, code: error.code });
            }
            throw error;
        }
    }

    private readAs(actor: string | undefined): StaffMember {
        const staff = authenticate(this.staffFor(actor));
        checkRole(staff, 'read');
        return staff;
    }

    private load(id: string): Application {
        const application = this.ports.applications.get(id);
        if (!application) {
            throw new DomainError('NOT_FOUND', `No application ${id}`);
        }
        return this.applyExpiry(application);
    }

    /**
     * Spec §6.3: strict 30 days from submission, or from the human review that reopened the
     * application if later. Applied on the next read or command.
     */
    private applyExpiry(application: Application): Application {
        const open = application.status === 'AWAITING_APPROVAL' || application.status === 'REFERRED';
        if (!open) {
            return application;
        }
        const windowStart = application.reopenedAt ?? application.submittedAt;
        const expiresAfter = addDays(new Date(windowStart), EXPIRY_DAYS);
        if (this.ports.clock.now().getTime() <= expiresAfter.getTime()) {
            return application;
        }
        const expired: Application = { ...application, status: 'EXPIRED' };
        this.ports.applications.save(expired);
        this.record('STATUS_CHANGED', SYSTEM_ACTOR, application.id, { from: application.status, to: 'EXPIRED' });
        return expired;
    }

    private staffFor(actor: string | undefined): StaffMember | undefined {
        return actor === undefined ? undefined : this.ports.staff.find(actor);
    }

    private recordNotice(application: Application): void {
        const notice = declineNoticeFor(application);
        this.record('DECLINE_NOTICE_ISSUED', application.decidedBy ?? SYSTEM_ACTOR, application.id, {
            reasons: notice.reasons.map((r) => r.code),
            creditReferenceAgencyDisclosed: notice.creditReferenceAgencyDisclosed,
        });
    }

    private record(
        type: AuditEvent['type'],
        actor: string,
        applicationId: string | null,
        payload: Record<string, unknown>,
    ): void {
        this.ports.audit.append({ type, at: this.ports.clock.now().toISOString(), actor, applicationId, payload });
    }
}

/** Spec §4.3 — runs after checks 1–2. Writes no audit event. */
function validate(input: NewApplication): void {
    const amount = parseMoney(input.amount);
    parseMoney(input.monthlyRepayment);
    const income = parseMoney(input.applicant.netMonthlyIncome);
    parseMoney(input.applicant.monthlyCreditCommitments);
    parseMoney(input.applicant.essentialMonthlyExpenditure);
    if (income.isZero()) {
        throw new DomainError('INVALID_MONEY', 'Net monthly income must be greater than zero');
    }
    if (amount.lessThan(PRODUCT_MIN_AMOUNT) || amount.greaterThan(PRODUCT_MAX_AMOUNT)) {
        throw new DomainError('AMOUNT_OUT_OF_RANGE');
    }
    if (!Number.isInteger(input.termMonths) || input.termMonths < MIN_TERM || input.termMonths > MAX_TERM) {
        throw new DomainError('TERM_OUT_OF_RANGE');
    }
}
