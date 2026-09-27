export * from './types.js';
export { DomainError, httpStatusFor, type DomainErrorCode } from './errors.js';
export { RULE_SET_VERSION, evaluate, creditBandFor, debtServiceRatio, type Evaluation } from './rules.js';
export { approvalLimitFor } from './authorisation.js';
export { DECLINE_REASON_TEXT, declineNoticeFor } from './decline-notice.js';
export type { Ports, Clock, CreditBureauGateway, StaffDirectory, ApplicationRepository, AuditLog } from './ports.js';
export {
    FIXTURE_CREDIT_REFERENCE_AGENCY,
    FixedClock,
    FixtureCreditBureau,
    InMemoryApplications,
    InMemoryAuditLog,
    InMemoryStaffDirectory,
    inMemoryPorts,
    type InMemoryPorts,
} from './in-memory.js';
export { LoanOriginationService } from './service.js';
