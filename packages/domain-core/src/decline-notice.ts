import { FIXTURE_CREDIT_REFERENCE_AGENCY } from './in-memory.js';
import type { Application, DeclineNotice, DeclineReason } from './types.js';

/** Spec §9. Plain-language text only: never rule IDs, thresholds, ratios or scores. */
export const DECLINE_REASON_TEXT: Record<DeclineReason, string> = {
    ELIGIBILITY_AGE: 'You do not meet our minimum age requirement.',
    CREDIT_HISTORY: 'Information from a credit reference agency about your credit history.',
    AFFORDABILITY_DSR: 'Your existing and proposed credit repayments are too high compared with your income.',
    AFFORDABILITY_RESIDUAL:
        'The income you would have left after essential spending and repayments is too low.',
    UNDERWRITER_DECISION: 'An underwriter reviewed your application and was unable to approve it.',
};

export function declineNoticeFor(application: Application): DeclineNotice {
    const disclosed = application.declineReasons.includes('CREDIT_HISTORY');
    return {
        applicationId: application.id,
        reasons: application.declineReasons.map((code) => ({ code, text: DECLINE_REASON_TEXT[code] })),
        creditReferenceAgencyDisclosed: disclosed,
        creditReferenceAgencyName: disclosed ? FIXTURE_CREDIT_REFERENCE_AGENCY : null,
        humanReviewAvailable: application.decisionType === 'AUTOMATED' && !application.humanReviewRequested,
    };
}
