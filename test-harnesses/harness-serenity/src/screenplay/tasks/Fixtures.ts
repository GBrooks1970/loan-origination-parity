import type { ApplicantDetails } from './Arrange.js';
import type { LoanTerms } from './Submit.js';

/**
 * The spec §13 fixtures. Preconditions are arranged the same way on every surface,
 * through the engine or the API, never through a user interface (Gherkin style guide).
 */

const STANDARD_DOB = '1991-03-15';

const ACCEPTED_APPLICANT: ApplicantDetails = {
    dateOfBirth: STANDARD_DOB,
    creditReferenceScore: 800,
    netMonthlyIncome: '5000.00',
    monthlyCreditCommitments: '500.00',
    essentialMonthlyExpenditure: '1500.00',
};

const REFER_OR_DECLINE_APPLICANT = (score: number): ApplicantDetails => ({
    dateOfBirth: STANDARD_DOB,
    creditReferenceScore: score,
    netMonthlyIncome: '4000.00',
    monthlyCreditCommitments: '800.00',
    essentialMonthlyExpenditure: '1500.00',
});

/** repayment = amount × 0.024, half-even to two places, in integer pence (no floating point). */
export function fixtureRepaymentFor(amount: string): string {
    const pence = BigInt(amount.replace('.', ''));
    const scaled = pence * 24n; // thousandths of a penny
    let whole = scaled / 1000n;
    const remainder = scaled % 1000n;
    if (remainder > 500n || (remainder === 500n && whole % 2n === 1n)) {
        whole += 1n;
    }
    const text = whole.toString().padStart(3, '0');
    return `${text.slice(0, -2)}.${text.slice(-2)}`;
}

export interface Fixture {
    applicant: ApplicantDetails;
    terms: LoanTerms;
    expectedStatus: string;
}

export const Fixtures = {
    acceptedApplicationFor: (amount: string): Fixture => ({
        applicant: ACCEPTED_APPLICANT,
        terms: { amount, termMonths: 60, monthlyRepayment: fixtureRepaymentFor(amount) },
        expectedStatus: 'AWAITING_APPROVAL',
    }),
    referredApplication: (): Fixture => ({
        applicant: REFER_OR_DECLINE_APPLICANT(650),
        terms: { amount: '10000.00', termMonths: 36, monthlyRepayment: '600.00' },
        expectedStatus: 'REFERRED',
    }),
    declinedApplication: (): Fixture => ({
        applicant: REFER_OR_DECLINE_APPLICANT(500),
        terms: { amount: '10000.00', termMonths: 36, monthlyRepayment: '600.00' },
        expectedStatus: 'DECLINED',
    }),
};
