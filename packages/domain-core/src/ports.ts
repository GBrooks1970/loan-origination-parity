import type { Application, AuditEvent, StaffMember } from './types.js';

/** Time enters only through this port, so every rule is deterministic under a virtual clock (DR-005). */
export interface Clock {
    now(): Date;
}

/** The only external dependency (DR-011). */
export interface CreditBureauGateway {
    scoreFor(applicantRef: string): number;
}

export interface StaffDirectory {
    find(username: string): StaffMember | undefined;
}

export interface ApplicationRepository {
    nextId(): string;
    save(application: Application): void;
    get(id: string): Application | undefined;
    list(): Application[];
}

export interface AuditLog {
    append(event: Omit<AuditEvent, 'sequence'>): AuditEvent;
    forApplication(applicationId: string): AuditEvent[];
}

export interface Ports {
    clock: Clock;
    bureau: CreditBureauGateway;
    staff: StaffDirectory;
    applications: ApplicationRepository;
    audit: AuditLog;
}
