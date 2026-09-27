import { inMemoryPorts } from '@lop/domain-core';

import { ApiBackend, CallLoanApi } from '../screenplay/abilities/CallLoanApi.js';
import { CallDomainCore, DomainCoreBackend } from '../screenplay/abilities/CallDomainCore.js';
import type { OperateTheWorkbench } from '../screenplay/abilities/OperateTheWorkbench.js';
import type { TestControlBackend } from '../screenplay/backend.js';

/** One isolated system per scenario (DR-005): a fresh engine, or (API) a fresh namespace. */
export interface SurfaceSession {
    readonly control: TestControlBackend;
    workbenchFor(username: string | undefined): OperateTheWorkbench;
    /** Set-up cost of this scenario in milliseconds, where the surface measures it. */
    setupMillis(): number | undefined;
    close(): Promise<void>;
}

export type SurfaceName = 'core' | 'api';

export function surfaceName(): SurfaceName {
    const value = process.env.SURFACE ?? 'core';
    if (value !== 'core' && value !== 'api') {
        throw new Error(`Unknown SURFACE "${value}"; expected core or api`);
    }
    return value;
}

export async function openSession(surface: SurfaceName): Promise<SurfaceSession> {
    switch (surface) {
        case 'core': {
            const backend = new DomainCoreBackend(inMemoryPorts());
            return {
                control: backend,
                workbenchFor: (username) => CallDomainCore.using(backend, username),
                setupMillis: () => undefined,
                close: async () => undefined,
            };
        }
        case 'api': {
            const backend = new ApiBackend({
                baseUrl: process.env.LOP_API_URL ?? 'http://127.0.0.1:8000',
                testControlToken: process.env.TEST_CONTROL_TOKEN ?? 'local-test-token',
            });
            return {
                control: backend,
                workbenchFor: (username) => CallLoanApi.using(backend, username),
                setupMillis: () => backend.setupMillis,
                close: () => backend.dispose(),
            };
        }
    }
}
