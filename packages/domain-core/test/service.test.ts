import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
    DomainError,
    LoanOriginationService,
    creditBandFor,
    debtServiceRatio,
    inMemoryPorts,
    type InMemoryPorts,
    type NewApplication,
} from '../src/index.js';
import { Dec } from '../src/money.js';
import { ageOn, parseIsoDate } from '../src/time.js';

const T0 = new Date('2026-10-01T09:00:00Z');

function standard(overrides: Partial<NewApplication> = {}, ref = 'std'): NewApplication {
    return {
        applicant: {
            applicantRef: ref,
            dateOfBirth: '1991-03-15',
            netMonthlyIncome: '5000.00',
            monthlyCreditCommitments: '500.00',
            essentialMonthlyExpenditure: '1500.00',
        },
        amount: '5000.00',
        termMonths: 60,
        monthlyRepayment: '120.00',
        ...overrides,
    };
}

function refused(fn: () => unknown, code: string): void {
    assert.throws(fn, (e: unknown) => e instanceof DomainError && e.code === code);
}

describe('LoanOriginationService', () => {
    let ports: InMemoryPorts;
    let service: LoanOriginationService;

    beforeEach(() => {
        ports = inMemoryPorts();
        ports.clock.set(T0);
        ports.staff.replace([
            { username: 'Olivia', role: 'LOAN_OFFICER' },
            { username: 'Liam', role: 'LOAN_OFFICER' },
            { username: 'Uma', role: 'UNDERWRITER' },
            { username: 'Sam', role: 'SENIOR_UNDERWRITER' },
            { username: 'Aled', role: 'AUDITOR' },
        ]);
        ports.bureau.set('std', 800);
        ports.bureau.set('refer', 650);
        ports.bureau.set('decline', 500);
        service = new LoanOriginationService(ports);
    });

    describe('check order (spec §7.2)', () => {
        it('reports SELF_APPROVAL before LIMIT_EXCEEDED', () => {
            const app = service.submit('Olivia', standard({ amount: '15000.00', monthlyRepayment: '360.00' }));
            refused(() => service.approve('Olivia', app.id), 'SELF_APPROVAL');
        });

        it('reports REFERRAL_AUTHORITY before LIMIT_EXCEEDED', () => {
            const ref = standard(
                {
                    amount: '15000.00',
                    monthlyRepayment: '600.00',
                },
                'refer',
            );
            ref.applicant = { ...ref.applicant, netMonthlyIncome: '4000.00', monthlyCreditCommitments: '800.00' };
            const app = service.submit('Olivia', ref);
            assert.equal(app.status, 'REFERRED');
            refused(() => service.approve('Liam', app.id), 'REFERRAL_AUTHORITY');
        });

        it('reports ROLE_NOT_PERMITTED before INVALID_STATE', () => {
            const app = service.submit('Olivia', standard());
            service.approve('Liam', app.id);
            refused(() => service.approve('Aled', app.id), 'ROLE_NOT_PERMITTED');
        });

        it('reports INVALID_STATE before NOT_APPLICATION_OWNER', () => {
            const app = service.submit('Olivia', standard());
            service.approve('Liam', app.id);
            refused(() => service.withdraw('Liam', app.id), 'INVALID_STATE');
        });

        it('treats an unknown username as unauthenticated and writes no audit event', () => {
            const app = service.submit('Olivia', standard());
            const before = ports.audit.all().length;
            refused(() => service.approve('Mallory', app.id), 'UNAUTHENTICATED');
            refused(() => service.approve(undefined, app.id), 'UNAUTHENTICATED');
            assert.equal(ports.audit.all().length, before);
        });
    });

    describe('submission', () => {
        it('audits a refused submission with a null application ID and creates nothing', () => {
            refused(() => service.submit('Aled', standard()), 'ROLE_NOT_PERMITTED');
            const denial = ports.audit.all().at(-1);
            assert.equal(denial?.type, 'AUTHORISATION_DENIED');
            assert.equal(denial?.applicationId, null);
            assert.equal(ports.applications.list().length, 0);
        });

        it('rejects invalid money without writing audit events', () => {
            refused(() => service.submit('Olivia', standard({ amount: '5000.001' })), 'INVALID_MONEY');
            refused(() => service.submit('Olivia', standard({ amount: '-1.00' })), 'INVALID_MONEY');
            const zeroIncome = standard();
            zeroIncome.applicant = { ...zeroIncome.applicant, netMonthlyIncome: '0.00' };
            refused(() => service.submit('Olivia', zeroIncome), 'INVALID_MONEY');
            assert.equal(ports.audit.all().length, 0);
        });

        it('allocates sequential IDs', () => {
            assert.equal(service.submit('Olivia', standard()).id, 'APP-000001');
            assert.equal(service.submit('Olivia', standard()).id, 'APP-000002');
        });

        it('writes submission, four rule results and a status change', () => {
            const app = service.submit('Olivia', standard());
            const types = service.auditTrail('Aled', app.id).map((e) => e.type);
            assert.deepEqual(types, [
                'APPLICATION_SUBMITTED',
                'RULE_EVALUATED',
                'RULE_EVALUATED',
                'RULE_EVALUATED',
                'RULE_EVALUATED',
                'STATUS_CHANGED',
            ]);
        });
    });

    describe('manual decline', () => {
        it('requires a reason, checked after authorisation', () => {
            const app = service.submit('Olivia', standard());
            refused(() => service.decline('Olivia', app.id, ''), 'SELF_APPROVAL');
            refused(() => service.decline('Liam', app.id, '  '), 'REASON_REQUIRED');
            assert.equal(service.get('Liam', app.id).status, 'AWAITING_APPROVAL');
        });

        it('keeps the underwriter note out of the decline notice', () => {
            const app = service.submit('Olivia', standard());
            service.decline('Liam', app.id, 'Income evidence inconsistent');
            const notice = service.declineNotice('Olivia', app.id);
            assert.deepEqual(notice.reasons.map((r) => r.code), ['UNDERWRITER_DECISION']);
            assert.equal(JSON.stringify(notice).includes('Income evidence inconsistent'), false);
            assert.equal(notice.humanReviewAvailable, false);
        });
    });

    describe('decline notice', () => {
        it('is refused for an application that is not declined', () => {
            const app = service.submit('Olivia', standard());
            refused(() => service.declineNotice('Olivia', app.id), 'INVALID_STATE');
        });

        it('names the agency only for a credit-history decline', () => {
            const app = service.submit('Olivia', standard({}, 'decline'));
            const notice = service.declineNotice('Olivia', app.id);
            assert.equal(notice.creditReferenceAgencyDisclosed, true);
            assert.equal(notice.creditReferenceAgencyName, 'Fixture Credit Reference Agency Ltd');
            assert.equal(notice.humanReviewAvailable, true);
        });
    });

    describe('expiry (spec §6.3)', () => {
        it('expires strictly after 30 days and records the system as actor', () => {
            const app = service.submit('Olivia', standard());
            ports.clock.set(new Date('2026-10-31T09:00:00Z'));
            assert.equal(service.get('Olivia', app.id).status, 'AWAITING_APPROVAL');
            ports.clock.set(new Date('2026-10-31T09:00:01Z'));
            assert.equal(service.get('Olivia', app.id).status, 'EXPIRED');
            const last = service.auditTrail('Olivia', app.id).at(-1);
            assert.equal(last?.actor, 'system');
            assert.deepEqual(last?.payload, { from: 'AWAITING_APPROVAL', to: 'EXPIRED' });
        });

        it('applies expiry to listings as well', () => {
            service.submit('Olivia', standard());
            ports.clock.set(new Date('2026-11-01T09:00:00Z'));
            assert.deepEqual(service.list('Aled').map((a) => a.status), ['EXPIRED']);
        });
    });

    describe('human review', () => {
        it('restarts the 30-day expiry window from the review request (spec v1.3)', () => {
            const app = service.submit('Olivia', standard({}, 'decline'));
            ports.clock.set(new Date('2026-10-31T09:00:00Z'));
            const reopened = service.requestHumanReview('Olivia', app.id);
            assert.equal(reopened.reopenedAt, '2026-10-31T09:00:00.000Z');
            ports.clock.set(new Date('2026-10-31T09:00:01Z'));
            assert.equal(service.get('Olivia', app.id).status, 'REFERRED');
            ports.clock.set(new Date('2026-11-30T09:00:00Z'));
            assert.equal(service.get('Olivia', app.id).status, 'REFERRED');
            ports.clock.set(new Date('2026-11-30T09:00:01Z'));
            assert.equal(service.get('Olivia', app.id).status, 'EXPIRED');
        });


        it('can be requested once, then is unavailable', () => {
            const app = service.submit('Olivia', standard({}, 'decline'));
            service.requestHumanReview('Olivia', app.id);
            service.decline('Sam', app.id, 'Confirmed on review');
            refused(() => service.requestHumanReview('Olivia', app.id), 'REVIEW_NOT_AVAILABLE');
        });
    });

    describe('roles', () => {
        it('takes a role change into account on the next command', () => {
            const app = service.submit('Olivia', standard({ amount: '15000.00', monthlyRepayment: '360.00' }));
            refused(() => service.approve('Liam', app.id), 'LIMIT_EXCEEDED');
            ports.staff.changeRole('Liam', 'UNDERWRITER');
            assert.equal(service.approve('Liam', app.id).status, 'APPROVED');
        });
    });
});

describe('rules', () => {
    it('maps band boundaries', () => {
        assert.deepEqual([999, 881, 880, 721, 720, 561, 560, 0].map(creditBandFor), ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D']);
    });

    it('rounds the debt service ratio half-even, which floating point gets wrong', () => {
        const dsr = debtServiceRatio(new Dec('400.30'), new Dec('300.00'), new Dec('2000.00'));
        assert.equal(dsr.toFixed(2), '35.02');
        assert.equal(((400.3 + 300) / 2000 * 100).toFixed(2), '35.01');
    });

    it('measures age on the London date', () => {
        const dob = parseIsoDate('2008-10-01');
        assert.equal(ageOn(dob, new Date('2026-09-30T23:30:00Z')), 18);
        assert.equal(ageOn(dob, new Date('2026-09-30T22:59:59Z')), 17);
    });
});
