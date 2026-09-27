/** Wire-level types. Shapes match DOCS/.architecture/openapi.yaml. Money is always a two-decimal string (DR-008). */

export type Money = string;
export type Percentage = string;

export const ROLES = ['LOAN_OFFICER', 'UNDERWRITER', 'SENIOR_UNDERWRITER', 'AUDITOR'] as const;
export type Role = (typeof ROLES)[number];

export type Status = 'AWAITING_APPROVAL' | 'REFERRED' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED';
export type Recommendation = 'ACCEPT' | 'REFER' | 'DECLINE';
export type CreditBand = 'A' | 'B' | 'C' | 'D';
export type DecisionType = 'AUTOMATED' | 'MANUAL';

export type RuleId = 'R01_AGE' | 'R02_CREDIT_BAND' | 'R03_DSR' | 'R04_RESIDUAL_INCOME';
export type RuleResultValue = 'PASS' | 'REFER' | 'FAIL' | 'NOT_APPLICABLE';

export type DeclineReason =
    | 'ELIGIBILITY_AGE'
    | 'CREDIT_HISTORY'
    | 'AFFORDABILITY_DSR'
    | 'AFFORDABILITY_RESIDUAL'
    | 'UNDERWRITER_DECISION';

export type DenialCode =
    | 'UNAUTHENTICATED'
    | 'ROLE_NOT_PERMITTED'
    | 'INVALID_STATE'
    | 'NOT_APPLICATION_OWNER'
    | 'SELF_APPROVAL'
    | 'REFERRAL_AUTHORITY'
    | 'LIMIT_EXCEEDED'
    | 'REVIEW_NOT_AVAILABLE'
    | 'REVIEW_WINDOW_CLOSED';

export type ValidationCode = 'AMOUNT_OUT_OF_RANGE' | 'TERM_OUT_OF_RANGE' | 'INVALID_MONEY' | 'REASON_REQUIRED';

export type Command = 'submit' | 'approve' | 'decline' | 'withdraw' | 'request human review' | 'read';

export interface StaffMember {
    username: string;
    role: Role;
    approvalLimit: Money | null;
}

export interface Applicant {
    applicantRef: string;
    dateOfBirth: string;
    netMonthlyIncome: Money;
    monthlyCreditCommitments: Money;
    essentialMonthlyExpenditure: Money;
}

export interface NewApplication {
    applicant: Applicant;
    amount: Money;
    termMonths: number;
    monthlyRepayment: Money;
}

export interface RuleResult {
    rule: RuleId;
    result: RuleResultValue;
    observed: string;
    threshold: string;
}

export interface Application {
    id: string;
    applicant: Applicant;
    status: Status;
    decisionType: DecisionType | null;
    recommendation: Recommendation;
    creditBand: CreditBand;
    debtServiceRatio: Percentage;
    ruleResults: RuleResult[];
    declineReasons: DeclineReason[];
    amount: Money;
    termMonths: number;
    monthlyRepayment: Money;
    createdBy: string;
    decidedBy: string | null;
    submittedAt: string;
    decidedAt: string | null;
    humanReviewRequested: boolean;
    ruleSetVersion: string;
}

export type AuditEventType =
    | 'APPLICATION_SUBMITTED'
    | 'RULE_EVALUATED'
    | 'STATUS_CHANGED'
    | 'AUTHORISATION_DENIED'
    | 'HUMAN_REVIEW_REQUESTED'
    | 'DECLINE_NOTICE_ISSUED';

export interface AuditEvent {
    sequence: number;
    type: AuditEventType;
    at: string;
    actor: string;
    applicationId: string | null;
    payload: Record<string, unknown>;
}

export interface DeclineNotice {
    applicationId: string;
    reasons: { code: DeclineReason; text: string }[];
    creditReferenceAgencyDisclosed: boolean;
    creditReferenceAgencyName: string | null;
    humanReviewAvailable: boolean;
}
