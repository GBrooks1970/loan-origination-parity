import { cookies } from 'next/headers';
import type {
    Application,
    ApplicationActions,
    AuditEvent,
    DeclineNotice,
    NewApplication,
    StaffActions,
    StaffMember,
} from '@lop/domain-core';

export type { Application, ApplicationActions, AuditEvent, DeclineNotice, NewApplication, StaffActions, StaffMember };

/** Server-side only. The browser never talks to the Node service; this server does (DR-004). */
export const API_URL = process.env.LOP_API_URL ?? 'http://127.0.0.1:8000';
export const SESSION_COOKIE = 'lop_session';
export const NAMESPACE_COOKIE = 'test-namespace';

/** Test mode is a runtime switch on the server (DR-005, DR-012): fixture sign-in and namespaces. */
export const testMode = (): boolean => process.env.LOP_TEST_MODE === '1';

/** A refusal or error from the Node API, carrying its problem+json code. */
export class ApiError extends Error {
    constructor(
        readonly code: string,
        readonly status: number,
    ) {
        super(code);
    }
}

/** Forwards only the caller's session and, in test mode, their namespace. */
async function upstreamHeaders(): Promise<Record<string, string>> {
    const jar = await cookies();
    const headers: Record<string, string> = { accept: 'application/json' };
    const session = jar.get(SESSION_COOKIE)?.value;
    if (session) headers.cookie = `${SESSION_COOKIE}=${encodeURIComponent(session)}`;
    const namespace = testMode() ? jar.get(NAMESPACE_COOKIE)?.value : undefined;
    if (namespace) headers['x-test-namespace'] = namespace;
    return headers;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers = await upstreamHeaders();
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(`${API_URL}/api/v1${path}`, {
        method,
        headers,
        cache: 'no-store',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    const payload = text ? (JSON.parse(text) as { code?: unknown }) : undefined;
    if (!res.ok) {
        throw new ApiError(typeof payload?.code === 'string' ? payload.code : 'UNEXPECTED_ERROR', res.status);
    }
    return payload as T;
}

const at = (id: string) => `/applications/${encodeURIComponent(id)}`;

/** Thin client over the Node service: no business rules live in the backend-for-frontend (DR-004). */
export const api = {
    me: () => call<StaffMember>('GET', '/me'),
    staffActions: () => call<StaffActions>('GET', '/me/actions'),
    applications: () => call<Application[]>('GET', '/applications'),
    application: (id: string) => call<Application>('GET', at(id)),
    actions: (id: string) => call<ApplicationActions>('GET', `${at(id)}/actions`),
    submit: (body: NewApplication) => call<Application>('POST', '/applications', body),
    approve: (id: string) => call<Application>('POST', `${at(id)}/approve`, {}),
    decline: (id: string, reason: string) => call<Application>('POST', `${at(id)}/decline`, { reason }),
    withdraw: (id: string) => call<Application>('POST', `${at(id)}/withdraw`, {}),
    requestHumanReview: (id: string) => call<Application>('POST', `${at(id)}/human-review`, {}),
    auditTrail: (id: string) => call<AuditEvent[]>('GET', `${at(id)}/audit`),
    declineNotice: (id: string) => call<DeclineNotice>('GET', `${at(id)}/decline-notice`),
};

/** The problem code of a failed call, for rendering an error marker. */
export const codeOf = (error: unknown): string => (error instanceof ApiError ? error.code : 'UNEXPECTED_ERROR');

/**
 * Fixture sign-in (DR-012), test mode only: asks the Node service for a session and returns the
 * cookie value it issued, so the caller can set it first-party on this origin.
 */
export async function fixtureSession(username: string, namespace: string | undefined): Promise<{ status: number; body: string; session?: string }> {
    const res = await fetch(`${API_URL}/api/v1/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(namespace ? { 'x-test-namespace': namespace } : {}) },
        body: JSON.stringify({ username }),
        cache: 'no-store',
    });
    const match = /(?:^|,\s*)lop_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '');
    return { status: res.status, body: await res.text(), ...(match ? { session: decodeURIComponent(match[1]!) } : {}) };
}
