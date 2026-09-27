import { Dec, formatMoney, parseMoney, roundHalfEven2 } from './money.js';
import { ageOn, parseIsoDate } from './time.js';
import type {
    Applicant,
    CreditBand,
    DeclineReason,
    Recommendation,
    RuleId,
    RuleResult,
    RuleResultValue,
} from './types.js';

/** Spec §5 — rule set 2026.10. */
export const RULE_SET_VERSION = '2026.10';

export const MINIMUM_AGE = 18;
export const MINIMUM_RESIDUAL_INCOME = new Dec('300.00');
export const LOWEST_ACCEPTABLE_BAND: CreditBand = 'C';
const REFER_MARGIN = new Dec('5.00');

const DSR_PASS_LIMIT: Record<Exclude<CreditBand, 'D'>, Dec> = {
    A: new Dec('40.00'),
    B: new Dec('35.00'),
    C: new Dec('30.00'),
};

const DECLINE_REASON_FOR: Record<RuleId, DeclineReason> = {
    R01_AGE: 'ELIGIBILITY_AGE',
    R02_CREDIT_BAND: 'CREDIT_HISTORY',
    R03_DSR: 'AFFORDABILITY_DSR',
    R04_RESIDUAL_INCOME: 'AFFORDABILITY_RESIDUAL',
};

export interface EvaluationInput {
    applicant: Applicant;
    monthlyRepayment: string;
    creditReferenceScore: number;
    now: Date;
}

export interface Evaluation {
    creditBand: CreditBand;
    debtServiceRatio: string;
    ruleResults: RuleResult[];
    recommendation: Recommendation;
    declineReasons: DeclineReason[];
}

/** Spec §5.1. */
export function creditBandFor(score: number): CreditBand {
    if (score >= 881) return 'A';
    if (score >= 721) return 'B';
    if (score >= 561) return 'C';
    return 'D';
}

/** Spec §5.2: half-even to two places before any comparison (DR-008). */
export function debtServiceRatio(commitments: Dec, repayment: Dec, netIncome: Dec): Dec {
    return roundHalfEven2(commitments.plus(repayment).dividedBy(netIncome).times(100));
}

/** Every rule is evaluated, in order, even after a failure (spec §5). */
export function evaluate(input: EvaluationInput): Evaluation {
    const income = parseMoney(input.applicant.netMonthlyIncome);
    const commitments = parseMoney(input.applicant.monthlyCreditCommitments);
    const essentials = parseMoney(input.applicant.essentialMonthlyExpenditure);
    const repayment = parseMoney(input.monthlyRepayment);

    const age = ageOn(parseIsoDate(input.applicant.dateOfBirth), input.now);
    const band = creditBandFor(input.creditReferenceScore);
    const dsr = debtServiceRatio(commitments, repayment, income);
    const residual = income.minus(commitments).minus(repayment).minus(essentials);

    const ruleResults: RuleResult[] = [
        {
            rule: 'R01_AGE',
            result: age >= MINIMUM_AGE ? 'PASS' : 'FAIL',
            observed: String(age),
            threshold: String(MINIMUM_AGE),
        },
        {
            rule: 'R02_CREDIT_BAND',
            result: band === 'D' ? 'FAIL' : 'PASS',
            observed: band,
            threshold: LOWEST_ACCEPTABLE_BAND,
        },
        dsrResult(band, dsr),
        {
            rule: 'R04_RESIDUAL_INCOME',
            result: residual.greaterThanOrEqualTo(MINIMUM_RESIDUAL_INCOME) ? 'PASS' : 'FAIL',
            observed: formatMoney(residual),
            threshold: formatMoney(MINIMUM_RESIDUAL_INCOME),
        },
    ];

    return {
        creditBand: band,
        debtServiceRatio: formatMoney(dsr),
        ruleResults,
        recommendation: combine(ruleResults.map((r) => r.result)),
        declineReasons: ruleResults.filter((r) => r.result === 'FAIL').map((r) => DECLINE_REASON_FOR[r.rule]),
    };
}

/** Spec §5.3. */
function dsrResult(band: CreditBand, dsr: Dec): RuleResult {
    if (band === 'D') {
        return { rule: 'R03_DSR', result: 'NOT_APPLICABLE', observed: formatMoney(dsr), threshold: 'none' };
    }
    const limit = DSR_PASS_LIMIT[band];
    const result: RuleResultValue = dsr.lessThanOrEqualTo(limit)
        ? 'PASS'
        : dsr.lessThanOrEqualTo(limit.plus(REFER_MARGIN))
          ? 'REFER'
          : 'FAIL';
    return { rule: 'R03_DSR', result, observed: formatMoney(dsr), threshold: formatMoney(limit) };
}

/** Spec §5.4: the worst result decides. */
function combine(results: RuleResultValue[]): Recommendation {
    if (results.includes('FAIL')) return 'DECLINE';
    if (results.includes('REFER')) return 'REFER';
    return 'ACCEPT';
}
