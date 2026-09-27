import { FixedClock, LoanOriginationService, inMemoryPorts, type InMemoryPorts } from '@lop/domain-core';

export interface Namespace {
    ports: InMemoryPorts;
    service: LoanOriginationService;
}

const DEFAULT_NAMESPACE = 'default';
const NAMESPACE_PATTERN = /^[a-z0-9-]{1,64}$/;

/**
 * One isolated engine per namespace (DR-005). Outside test mode there is a single namespace
 * whose clock follows the system clock.
 */
export class Namespaces {
    private readonly items = new Map<string, Namespace>();

    constructor(private readonly testMode: boolean) {}

    static isValid(name: string): boolean {
        return NAMESPACE_PATTERN.test(name);
    }

    resolve(requested: string | undefined): Namespace {
        const name = this.testMode ? requested : DEFAULT_NAMESPACE;
        if (!name || !Namespaces.isValid(name)) {
            throw new NamespaceRequired();
        }
        let namespace = this.items.get(name);
        if (!namespace) {
            const ports = inMemoryPorts();
            if (!this.testMode) {
                ports.clock = new SystemClock();
            }
            namespace = { ports, service: new LoanOriginationService(ports) };
            this.items.set(name, namespace);
        }
        return namespace;
    }

    reset(name: string): void {
        this.items.delete(name);
    }
}

export class NamespaceRequired extends Error {
    constructor() {
        super('X-Test-Namespace header is required in test mode');
    }
}

class SystemClock extends FixedClock {
    override now(): Date {
        return new Date();
    }
}
