import { inMemoryPorts } from '@lop/domain-core';

import { CallDomainCore, DomainCoreBackend } from '../screenplay/abilities/CallDomainCore.js';
import type { OperateTheWorkbench } from '../screenplay/abilities/OperateTheWorkbench.js';
import type { TestControlBackend } from '../screenplay/backend.js';

/** One isolated system per scenario (DR-005): a fresh engine, or (API) a fresh namespace. */
export interface SurfaceSession {
    readonly control: TestControlBackend;
    workbenchFor(username: string | undefined): OperateTheWorkbench;
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
            return { control: backend, workbenchFor: (username) => CallDomainCore.using(backend, username) };
        }
        case 'api':
            throw new Error('The API surface is not wired yet');
    }
}
