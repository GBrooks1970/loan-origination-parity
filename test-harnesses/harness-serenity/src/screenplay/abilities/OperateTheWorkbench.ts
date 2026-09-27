import { Ability } from '@serenity-js/core';
import type { Application, AuditEvent, DeclineNotice, NewApplication } from '@lop/domain-core';

import type { WorkbenchBackend } from '../backend.js';

/**
 * Abstract ability: a member of staff (or an unauthenticated visitor) using the workbench.
 * Concrete surfaces subclass it; Tasks ask for `OperateTheWorkbench.as(actor)` and never learn which (DR-006).
 */
export abstract class OperateTheWorkbench extends Ability {
    constructor(
        protected readonly backend: WorkbenchBackend,
        public readonly username: string | undefined,
    ) {
        super();
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
