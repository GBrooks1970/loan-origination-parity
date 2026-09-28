import { Ability } from '@serenity-js/core';
import type { Application, AuditEvent, DeclineNotice, NewApplication } from '@lop/domain-core';

import type { WorkbenchBackend } from '../backend.js';

/**
 * Abstract ability: a member of staff (or an unauthenticated visitor) using the workbench.
 * Concrete surfaces subclass it; Tasks ask for `OperateTheWorkbench.as(actor)` and never learn which (DR-006).
 */
export abstract class OperateTheWorkbench extends Ability {
    /**
     * @param backend how this actor normally works on this surface (on a UI surface: the screens)
     * @param arrange how preconditions are arranged: always through the engine or API, never the UI (style guide)
     * @param force how refused commands are forced past the UI (DR-010); on non-UI surfaces this is the backend itself
     */
    constructor(
        protected readonly backend: WorkbenchBackend,
        public readonly username: string | undefined,
        private readonly arrange: WorkbenchBackend = backend,
        private readonly force: WorkbenchBackend = backend,
    ) {
        super();
    }

    /** Preconditions ("Olivia has submitted…"). */
    arranging(): WorkbenchSession {
        return new WorkbenchSession(this.arrange, this.username);
    }

    /** "{actor} forces the … command": straight at the server, whatever the UI offers. */
    forcing(): WorkbenchSession {
        return new WorkbenchSession(this.force, this.username);
    }

    submit(input: NewApplication): Promise<Application> {
        return this.backend.submit(this.username, input);
    }

    approve(id: string): Promise<Application> {
        return this.backend.approve(this.username, id);
    }

    decline(id: string, reason: string): Promise<Application> {
        return this.backend.decline(this.username, id, reason);
    }

    withdraw(id: string): Promise<Application> {
        return this.backend.withdraw(this.username, id);
    }

    requestHumanReview(id: string): Promise<Application> {
        return this.backend.requestHumanReview(this.username, id);
    }

    application(id: string): Promise<Application> {
        return this.backend.get(this.username, id);
    }

    applications(): Promise<Application[]> {
        return this.backend.list(this.username);
    }

    auditTrail(id: string): Promise<AuditEvent[]> {
        return this.backend.auditTrail(this.username, id);
    }

    declineNotice(id: string): Promise<DeclineNotice> {
        return this.backend.declineNotice(this.username, id);
    }
}

/** The same operations bound to a specific route (arranging or forcing). */
export class WorkbenchSession {
    constructor(
        private readonly backend: WorkbenchBackend,
        private readonly username: string | undefined,
    ) {}

    submit(input: NewApplication) {
        return this.backend.submit(this.username, input);
    }
    approve(id: string) {
        return this.backend.approve(this.username, id);
    }
    decline(id: string, reason: string) {
        return this.backend.decline(this.username, id, reason);
    }
    withdraw(id: string) {
        return this.backend.withdraw(this.username, id);
    }
    requestHumanReview(id: string) {
        return this.backend.requestHumanReview(this.username, id);
    }
}
