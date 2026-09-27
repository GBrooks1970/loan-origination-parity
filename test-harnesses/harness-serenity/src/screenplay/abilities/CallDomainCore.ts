import { DomainError, LoanOriginationService, type InMemoryPorts } from '@lop/domain-core';

import { Refusal, type TestControlBackend, type WorkbenchBackend } from '../backend.js';
import { OperateTheWorkbench } from './OperateTheWorkbench.js';

/** Surface 1: the engine in-process, with in-memory ports. No transport at all. */
export class CallDomainCore extends OperateTheWorkbench {
    static using(backend: DomainCoreBackend, username: string | undefined): CallDomainCore {
        return new CallDomainCore(backend, username);
    }
}

export class DomainCoreBackend implements WorkbenchBackend, TestControlBackend {
    readonly surface = 'core';
    private readonly service: LoanOriginationService;

    constructor(private readonly ports: InMemoryPorts) {
        this.service = new LoanOriginationService(ports);
    }

    submit = this.call((user, input: Parameters<LoanOriginationService['submit']>[1]) => this.service.submit(user, input));
    approve = this.call((user, id: string) => this.service.approve(user, id));
    decline = this.call((user, id: string, reason: string) => this.service.decline(user, id, reason));
    withdraw = this.call((user, id: string) => this.service.withdraw(user, id));
    requestHumanReview = this.call((user, id: string) => this.service.requestHumanReview(user, id));
    get = this.call((user, id: string) => this.service.get(user, id));
    list = this.call((user) => this.service.list(user));
    auditTrail = this.call((user, id: string) => this.service.auditTrail(user, id));
    declineNotice = this.call((user, id: string) => this.service.declineNotice(user, id));

    async setClock(instant: string): Promise<void> {
        this.ports.clock.set(new Date(instant));
    }

    async setStaff(entries: Parameters<TestControlBackend['setStaff']>[0]): Promise<void> {
        this.ports.staff.replace(entries);
    }

    async changeRole(username: string, role: Parameters<TestControlBackend['changeRole']>[1]): Promise<void> {
        this.ports.staff.changeRole(username, role);
    }

    async setCreditScore(applicantRef: string, score: number): Promise<void> {
        this.ports.bureau.set(applicantRef, score);
    }

    /** Presents engine refusals exactly as the API surface does: as a Refusal carrying the code. */
    private call<A extends unknown[], R>(fn: (user: string | undefined, ...args: A) => R) {
        return async (user: string | undefined, ...args: A): Promise<R> => {
            try {
                return fn(user, ...args);
            } catch (error) {
                if (error instanceof DomainError) {
                    throw new Refusal(error.code);
                }
                throw error;
            }
        };
    }
}
