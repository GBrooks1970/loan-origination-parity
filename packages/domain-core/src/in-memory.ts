import { approvalLimitFor } from './authorisation.js';
import type {
    ApplicationRepository,
    AuditLog,
    Clock,
    CreditBureauGateway,
    Ports,
    StaffDirectory,
} from './ports.js';
import type { Application, AuditEvent, Role, StaffMember } from './types.js';

/**
 * In-memory adapters for every port. Used by the Node service (one set per test namespace, DR-005)
 * and by the harness's domain-core surface. They hold state but perform no I/O.
 */

export class FixedClock implements Clock {
    constructor(private instant: Date = new Date(0)) {}

    now(): Date {
        return new Date(this.instant.getTime());
    }

    set(instant: Date): void {
        this.instant = new Date(instant.getTime());
    }
}

export const FIXTURE_CREDIT_REFERENCE_AGENCY = 'Fixture Credit Reference Agency Ltd';

export class FixtureCreditBureau implements CreditBureauGateway {
    private readonly scores = new Map<string, number>();

    set(applicantRef: string, score: number): void {
        if (!Number.isInteger(score) || score < 0 || score > 999) {
            throw new RangeError(`Credit reference score must be an integer 0-999, got ${score}`);
        }
        this.scores.set(applicantRef, score);
    }

    scoreFor(applicantRef: string): number {
        const score = this.scores.get(applicantRef);
        if (score === undefined) {
            throw new Error(`No fixture credit reference score for applicant ${applicantRef}`);
        }
        return score;
    }
}

export class InMemoryStaffDirectory implements StaffDirectory {
    private readonly members = new Map<string, StaffMember>();

    replace(entries: { username: string; role: Role }[]): void {
        this.members.clear();
        for (const { username, role } of entries) {
            this.members.set(username, { username, role, approvalLimit: approvalLimitFor(role) });
        }
    }

    changeRole(username: string, role: Role): void {
        if (!this.members.has(username)) {
            throw new Error(`Unknown staff member ${username}`);
        }
        this.members.set(username, { username, role, approvalLimit: approvalLimitFor(role) });
    }

    find(username: string): StaffMember | undefined {
        return this.members.get(username);
    }
}

export class InMemoryApplications implements ApplicationRepository {
    private readonly items = new Map<string, Application>();
    private counter = 0;

    nextId(): string {
        this.counter += 1;
        return `APP-${String(this.counter).padStart(6, '0')}`;
    }

    save(application: Application): void {
        this.items.set(application.id, structuredClone(application));
    }

    get(id: string): Application | undefined {
        const found = this.items.get(id);
        return found ? structuredClone(found) : undefined;
    }

    list(): Application[] {
        return [...this.items.values()].map((a) => structuredClone(a));
    }
}

export class InMemoryAuditLog implements AuditLog {
    private readonly events: AuditEvent[] = [];

    append(event: Omit<AuditEvent, 'sequence'>): AuditEvent {
        const stored = { sequence: this.events.length + 1, ...structuredClone(event) };
        this.events.push(stored);
        return structuredClone(stored);
    }

    forApplication(applicationId: string): AuditEvent[] {
        return this.events.filter((e) => e.applicationId === applicationId).map((e) => structuredClone(e));
    }

    all(): AuditEvent[] {
        return this.events.map((e) => structuredClone(e));
    }
}

export interface InMemoryPorts extends Ports {
    clock: FixedClock;
    bureau: FixtureCreditBureau;
    staff: InMemoryStaffDirectory;
    applications: InMemoryApplications;
    audit: InMemoryAuditLog;
}

export function inMemoryPorts(): InMemoryPorts {
    return {
        clock: new FixedClock(),
        bureau: new FixtureCreditBureau(),
        staff: new InMemoryStaffDirectory(),
        applications: new InMemoryApplications(),
        audit: new InMemoryAuditLog(),
    };
}
