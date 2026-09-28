import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

import { createApp } from '../src/app.js';

/**
 * Contract test: every response the service returns in this walk-through is validated against
 * DOCS/.architecture/openapi.yaml for its path, method and status.
 */
const specPath = new URL('../../../DOCS/.architecture/openapi.yaml', import.meta.url);
const spec = parse(readFileSync(specPath, 'utf8')) as Record<string, any>;

const ajv = new Ajv2020({ strict: false, allErrors: true });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
ajv.addSchema(spec, 'openapi.json');

const pointer = (...parts: string[]) => parts.map((p) => p.replace(/~/g, '~0').replace(/\//g, '~1')).join('/');

function responseSchemaRef(path: string, method: string, status: number): string | undefined {
    let response = spec.paths[path]?.[method]?.responses?.[String(status)];
    let base = `#/${pointer('paths', path, method, 'responses', String(status))}`;
    if (!response) return undefined;
    if (response.$ref) {
        base = response.$ref;
        response = base.slice(2).split('/').reduce((node: any, key: string) => node[key.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
    }
    const media = Object.keys(response.content ?? {})[0];
    return media ? `openapi.json${base}/${pointer('content', media, 'schema')}` : undefined;
}

const TOKEN = 'contract-token';
let server: Server;
let baseUrl: string;
const cookies = new Map<string, string>();
let checked = 0;

async function call(
    method: string,
    specPathTemplate: string,
    url: string,
    options: { body?: unknown; as?: string; namespace?: string | null; token?: boolean } = {},
) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (options.namespace !== null) headers['x-test-namespace'] = options.namespace ?? 'contract';
    if (options.as && cookies.has(options.as)) headers.cookie = cookies.get(options.as)!;
    if (options.token) headers['x-test-control-token'] = TOKEN;
    const res = await fetch(baseUrl + url, {
        method,
        headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : undefined;
    const ref = responseSchemaRef(specPathTemplate, method.toLowerCase(), res.status);
    if (res.status !== 404 || spec.paths[specPathTemplate]) {
        assert.ok(
            spec.paths[specPathTemplate]?.[method.toLowerCase()]?.responses?.[String(res.status)],
            `${method} ${specPathTemplate} returned ${res.status}, which the contract does not declare`,
        );
    }
    if (ref) {
        const validate = ajv.getSchema(ref) ?? ajv.compile({ $ref: ref });
        assert.ok(validate(body), `${method} ${url} ${res.status}: ${ajv.errorsText(validate.errors)}`);
        checked += 1;
    }
    return { status: res.status, body, setCookie: res.headers.get('set-cookie') };
}

const applicant = (ref: string) => ({
    applicantRef: ref,
    dateOfBirth: '1991-03-15',
    netMonthlyIncome: '3000.00',
    monthlyCreditCommitments: '450.00',
    essentialMonthlyExpenditure: '1200.00',
});

describe('demoapp001-node-service contract (test mode)', () => {
    before(async () => {
        server = createApp({ port: 0, testMode: true, testControlToken: TOKEN, sessionSecret: 'contract-secret' }).listen(0);
        await new Promise((resolve) => server.once('listening', resolve));
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        await call('PUT', '/__test__/namespaces/{ns}/clock', '/__test__/namespaces/contract/clock', {
            body: { now: '2026-10-01T09:00:00Z' },
            token: true,
        });
        await call('PUT', '/__test__/namespaces/{ns}/staff', '/__test__/namespaces/contract/staff', {
            body: [
                { username: 'Olivia', role: 'LOAN_OFFICER' },
                { username: 'Liam', role: 'LOAN_OFFICER' },
                { username: 'Aled', role: 'AUDITOR' },
            ],
            token: true,
        });
        for (const [ref, score] of [['a1', 800], ['a2', 500]] as const) {
            await call('PUT', '/__test__/namespaces/{ns}/bureau/{applicantRef}', `/__test__/namespaces/contract/bureau/${ref}`, {
                body: { score },
                token: true,
            });
        }
        for (const username of ['Olivia', 'Liam', 'Aled']) {
            const { status, setCookie } = await call('POST', '/api/v1/session', '/api/v1/session', { body: { username } });
            assert.equal(status, 204);
            cookies.set(username, setCookie!.split(';')[0]!);
        }
    });

    after(() => {
        server.close();
    });

    it('serves every documented operation with contract-valid bodies', async () => {
        assert.equal((await call('GET', '/health', '/health', { namespace: null })).status, 200);
        assert.equal((await call('GET', '/api/v1/me', '/api/v1/me', { as: 'Liam' })).body.approvalLimit, '10000.00');

        const accepted = await call('POST', '/api/v1/applications', '/api/v1/applications', {
            as: 'Olivia',
            body: { applicant: applicant('a1'), amount: '5000.00', termMonths: 36, monthlyRepayment: '300.00' },
        });
        assert.equal(accepted.status, 201);
        assert.equal(accepted.body.status, 'AWAITING_APPROVAL');
        const id = accepted.body.id as string;

        assert.equal((await call('GET', '/api/v1/applications/{id}', `/api/v1/applications/${id}`, { as: 'Aled' })).status, 200);
        assert.equal((await call('GET', '/api/v1/applications', '/api/v1/applications?status=AWAITING_APPROVAL', { as: 'Aled' })).body.length, 1);

        const actions = await call('GET', '/api/v1/applications/{id}/actions', `/api/v1/applications/${id}/actions`, { as: 'Olivia' });
        assert.deepEqual(actions.body.approve, { available: false, reason: 'SELF_APPROVAL' });
        const staffActions = await call('GET', '/api/v1/me/actions', '/api/v1/me/actions', { as: 'Aled' });
        assert.deepEqual(staffActions.body.submit, { available: false, reason: 'ROLE_NOT_PERMITTED' });

        const self = await call('POST', '/api/v1/applications/{id}/approve', `/api/v1/applications/${id}/approve`, { as: 'Olivia' });
        assert.deepEqual([self.status, self.body.code], [403, 'SELF_APPROVAL']);

        const blank = await call('POST', '/api/v1/applications/{id}/decline', `/api/v1/applications/${id}/decline`, {
            as: 'Liam',
            body: { reason: ' ' },
        });
        assert.deepEqual([blank.status, blank.body.code], [422, 'REASON_REQUIRED']);

        const approved = await call('POST', '/api/v1/applications/{id}/approve', `/api/v1/applications/${id}/approve`, { as: 'Liam' });
        assert.equal(approved.body.status, 'APPROVED');

        const withdraw = await call('POST', '/api/v1/applications/{id}/withdraw', `/api/v1/applications/${id}/withdraw`, { as: 'Olivia' });
        assert.deepEqual([withdraw.status, withdraw.body.code], [409, 'INVALID_STATE']);

        const audit = await call('GET', '/api/v1/applications/{id}/audit', `/api/v1/applications/${id}/audit`, { as: 'Aled' });
        assert.ok(audit.body.some((e: { type: string }) => e.type === 'AUTHORISATION_DENIED'));

        const declined = await call('POST', '/api/v1/applications', '/api/v1/applications', {
            as: 'Olivia',
            body: { applicant: applicant('a2'), amount: '5000.00', termMonths: 36, monthlyRepayment: '300.00' },
        });
        const notice = await call('GET', '/api/v1/applications/{id}/decline-notice', `/api/v1/applications/${declined.body.id}/decline-notice`, {
            as: 'Olivia',
        });
        assert.equal(notice.body.creditReferenceAgencyDisclosed, true);
        const review = await call('POST', '/api/v1/applications/{id}/human-review', `/api/v1/applications/${declined.body.id}/human-review`, {
            as: 'Olivia',
        });
        assert.equal(review.body.status, 'REFERRED');

        const invalid = await call('POST', '/api/v1/applications', '/api/v1/applications', {
            as: 'Olivia',
            body: { applicant: applicant('a1'), amount: '999.99', termMonths: 36, monthlyRepayment: '300.00' },
        });
        assert.deepEqual([invalid.status, invalid.body.code], [422, 'AMOUNT_OUT_OF_RANGE']);

        const anonymous = await call('GET', '/api/v1/applications/{id}', `/api/v1/applications/${id}`);
        assert.deepEqual([anonymous.status, anonymous.body.code], [401, 'UNAUTHENTICATED']);

        const missing = await call('GET', '/api/v1/applications/{id}', '/api/v1/applications/APP-999999', { as: 'Aled' });
        assert.deepEqual([missing.status, missing.body.code], [404, 'NOT_FOUND']);

        assert.ok(checked >= 18, `expected at least 18 schema-validated bodies, made ${checked}`);
    });

    it('isolates namespaces', async () => {
        const other = await call('GET', '/api/v1/applications', '/api/v1/applications', { as: 'Aled', namespace: 'another' });
        assert.deepEqual([other.status, other.body.code], [401, 'UNAUTHENTICATED']);
    });

    it('rejects test control without the token', async () => {
        const res = await fetch(`${baseUrl}/__test__/namespaces/contract/reset`, { method: 'POST' });
        assert.equal(res.status, 401);
    });
});

describe('demoapp001-node-service outside test mode', () => {
    it('does not expose test control or fixture sign-in (DR-005, DR-012)', async () => {
        const production = createApp({ port: 0, testMode: false, testControlToken: undefined, sessionSecret: 's' }).listen(0);
        await new Promise((resolve) => production.once('listening', resolve));
        const url = `http://127.0.0.1:${(production.address() as AddressInfo).port}`;
        try {
            const control = await fetch(`${url}/__test__/namespaces/x/reset`, { method: 'POST', headers: { 'x-test-control-token': 'anything' } });
            const session = await fetch(`${url}/api/v1/session`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ username: 'Olivia' }),
            });
            assert.deepEqual([control.status, session.status], [404, 404]);
        } finally {
            production.close();
        }
    });
});
