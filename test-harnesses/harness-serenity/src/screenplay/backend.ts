import type { Application, AuditEvent, DeclineNotice, NewApplication, Role } from '@lop/domain-core';

/**
 * What a surface must provide. The domain-core surface calls the engine in-process;
 * the API surface calls the Node service over HTTP. Tasks and questions depend only on this.
 * `user` undefined means nobody is signed in.
 */
export interface WorkbenchBackend {
    readonly surface: string;
    submit(user: string | undefined, input: NewApplication): Promise<Application>;
    approve(user: string | undefined, id: string): Promise<Application>;
    decline(user: string | undefined, id: string, reason: string): Promise<Application>;
    withdraw(user: string | undefined, id: string): Promise<Application>;
    requestHumanReview(user: string | undefined, id: string): Promise<Application>;
    get(user: string | undefined, id: string): Promise<Application>;
    list(user: string | undefined): Promise<Application[]>;
    auditTrail(user: string | undefined, id: string): Promise<AuditEvent[]>;
    declineNotice(user: string | undefined, id: string): Promise<DeclineNotice>;
}

/** Arranging state: clock, staff, credit reference fixtures (spec §11). */
export interface TestControlBackend {
    setClock(instant: string): Promise<void>;
    setStaff(entries: { username: string; role: Role }[]): Promise<void>;
    changeRole(username: string, role: Role): Promise<void>;
    setCreditScore(applicantRef: string, score: number): Promise<void>;
}

/** A command the system under test refused, with its spec §7.2 / §4.3 code. */
export class Refusal extends Error {
    constructor(public readonly code: string) {
        super(`Refused: ${code}`);
        this.name = 'Refusal';
    }
}
