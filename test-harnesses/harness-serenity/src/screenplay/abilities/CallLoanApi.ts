import { randomUUID } from 'node:crypto';
import type { Application, AuditEvent, DeclineNotice, NewApplication, Role } from '@lop/domain-core';

import { Refusal, type TestControlBackend, type WorkbenchBackend } from '../backend.js';
import { OperateTheWorkbench } from './OperateTheWorkbench.js';

/** Surface 2: the Node service over HTTP, one namespace per scenario (DR-005). */
export class CallLoanApi extends OperateTheWorkbench {
    static using(backend: ApiBackend, username: string | undefined): CallLoanApi {
        return new CallLoanApi(backend, username);
    }
}

export interface ApiSettings {
    baseUrl: string;
    testControlToken: string;
}

export class ApiBackend implements WorkbenchBackend, TestControlBackend {
    readonly surface = 'api';
    readonly namespace = `s-${randomUUID()}`;
    /** Milliseconds spent in test-control calls this scenario: the reset/set-up cost (spec §11 target). */
    setupMillis = 0;
    private readonly sessions = new Map<string, string>();

    constructor(private readonly settings: ApiSettings) {}

    // --- workbench ------------------------------------------------------------------------------

    submit = (user: string | undefined, input: NewApplication) =>
        this.api<Application>(user, 'POST', '/applications', input);
    approve = (user: string | undefined, id: string) => this.api<Application>(user, 'POST', `/applications/${id}/approve`);
    decline = (user: string | undefined, id: string, reason: string) =>
        this.api<Application>(user, 'POST', `/applications/${id}/decline`, { reason });
    withdraw = (user: string | undefined, id: string) => this.api<Application>(user, 'POST', `/applications/${id}/withdraw`);
    requestHumanReview = (user: string | undefined, id: string) =>
        this.api<Application>(user, 'POST', `/applications/${id}/human-review`);
    get = (user: string | undefined, id: string) => this.api<Application>(user, 'GET', `/applications/${id}`);
    list = (user: string | undefined) => this.api<Application[]>(user, 'GET', '/applications');
    auditTrail = (user: string | undefined, id: string) => this.api<AuditEvent[]>(user, 'GET', `/applications/${id}/audit`);
    declineNotice = (user: string | undefined, id: string) =>
        this.api<DeclineNotice>(user, 'GET', `/applications/${id}/decline-notice`);

    // --- test control ---------------------------------------------------------------------------

    setClock = (instant: string) => this.control('PUT', 'clock', { now: instant });
    setStaff = (entries: { username: string; role: Role }[]) => this.control('PUT', 'staff', entries);
    setCreditScore = (applicantRef: string, score: number) =>
        this.control('PUT', `bureau/${encodeURIComponent(applicantRef)}`, { score });

    /** Roles are resolved server-side on every request (DR-012), so no new session is needed. */
    async changeRole(username: string, role: Role): Promise<void> {
        const staff = await this.currentStaff();
        await this.setStaff(staff.map((s) => (s.username === username ? { username, role } : s)));
    }

    /** Frees the namespace after the scenario. Isolation does not depend on it. */
    dispose = () => this.control('POST', 'reset');

    // --- plumbing -------------------------------------------------------------------------------

    private staffDirectory: { username: string; role: Role }[] = [];

    private async currentStaff() {
        return this.staffDirectory;
    }

    private async control(method: string, path: string, body?: unknown): Promise<void> {
        if (path === 'staff') this.staffDirectory = body as { username: string; role: Role }[];
        const started = performance.now();
        const res = await fetch(`${this.settings.baseUrl}/__test__/namespaces/${this.namespace}/${path}`, {
            method,
            headers: { 'content-type': 'application/json', 'x-test-control-token': this.settings.testControlToken },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        this.setupMillis += performance.now() - started;
        if (!res.ok) {
            throw new Error(`Test control ${method} ${path} failed: ${res.status} ${await res.text()}`);
        }
    }

    private async sessionCookie(user: string): Promise<string | undefined> {
        const cached = this.sessions.get(user);
        if (cached) return cached;
        const res = await fetch(`${this.settings.baseUrl}/api/v1/session`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-test-namespace': this.namespace },
            body: JSON.stringify({ username: user }),
        });
        if (res.status !== 204) {
            return undefined; // not a known staff member: requests go unauthenticated
        }
        const cookie = res.headers.get('set-cookie')?.split(';')[0];
        if (cookie) this.sessions.set(user, cookie);
        return cookie;
    }

    private async api<T>(user: string | undefined, method: string, path: string, body?: unknown): Promise<T> {
        const headers: Record<string, string> = { 'content-type': 'application/json', 'x-test-namespace': this.namespace };
        const cookie = user === undefined ? undefined : await this.sessionCookie(user);
        if (cookie) headers.cookie = cookie;
        const res = await fetch(`${this.settings.baseUrl}/api/v1${path}`, {
            method,
            headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await res.text();
        const payload = text ? JSON.parse(text) : undefined;
        if (!res.ok) {
            if (payload && typeof payload.code === 'string' && res.status < 500 && payload.code !== 'INVALID_REQUEST') {
                throw new Refusal(payload.code);
            }
            throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
        }
        return payload as T;
    }
}
