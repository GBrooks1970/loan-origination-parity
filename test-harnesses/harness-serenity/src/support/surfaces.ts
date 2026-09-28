import { inMemoryPorts } from '@lop/domain-core';

import { chromium, type Browser } from 'playwright';

import { BrowseTheWorkbench, BrowserBackend } from '../screenplay/abilities/BrowseTheWorkbench.js';
import { UseTheScreens } from '../screenplay/abilities/UseTheScreens.js';
import { ApiBackend, CallLoanApi } from '../screenplay/abilities/CallLoanApi.js';
import { CallDomainCore, DomainCoreBackend } from '../screenplay/abilities/CallDomainCore.js';
import type { OperateTheWorkbench } from '../screenplay/abilities/OperateTheWorkbench.js';
import type { TestControlBackend } from '../screenplay/backend.js';

/** One isolated system per scenario (DR-005): a fresh engine, or (API) a fresh namespace. */
export interface SurfaceSession {
    readonly control: TestControlBackend;
    workbenchFor(username: string | undefined): OperateTheWorkbench;
    /** UI-only abilities; present only on browser surfaces. */
    screensFor?(username: string | undefined): UseTheScreens;
    /** Set-up cost of this scenario in milliseconds, where the surface measures it. */
    setupMillis(): number | undefined;
    close(): Promise<void>;
}

export type SurfaceName = 'core' | 'api' | 'angular';

export function surfaceName(): SurfaceName {
    const value = process.env.SURFACE ?? 'core';
    if (value !== 'core' && value !== 'api' && value !== 'angular') {
        throw new Error(`Unknown SURFACE "${value}"; expected core, api or angular`);
    }
    return value;
}

let browser: Promise<Browser> | undefined;

/** One browser for the run; each scenario and each member of staff gets its own context. */
function sharedBrowser(): Promise<Browser> {
    browser ??= chromium.launch({
        headless: true,
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    });
    return browser;
}

export async function closeSharedBrowser(): Promise<void> {
    if (browser) await (await browser).close();
    browser = undefined;
}

const apiBackend = () =>
    new ApiBackend({
        baseUrl: process.env.LOP_API_URL ?? 'http://127.0.0.1:8000',
        testControlToken: process.env.TEST_CONTROL_TOKEN ?? 'local-test-token',
    });

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
        case 'angular': {
            const api = apiBackend();
            const ui = new BrowserBackend(await sharedBrowser(), api, {
                baseUrl: process.env.LOP_UI_URL ?? 'http://127.0.0.1:4200',
                surface: 'angular',
            });
            return {
                control: api,
                workbenchFor: (username) => BrowseTheWorkbench.using(ui, username),
                screensFor: (username) => UseTheScreens.using(ui, username),
                setupMillis: () => api.setupMillis,
                close: async () => {
                    await ui.close();
                    await api.dispose();
                },
            };
        }
        case 'api': {
            const backend = apiBackend();
            return {
                control: backend,
                workbenchFor: (username) => CallLoanApi.using(backend, username),
                setupMillis: () => backend.setupMillis,
                close: () => backend.dispose(),
            };
        }
    }
}
