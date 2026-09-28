import { cookies } from 'next/headers';

import { fixtureSession, NAMESPACE_COOKIE, SESSION_COOKIE, testMode } from '@/lib/api';

const problem = (status: number, code: string, detail: string) =>
    Response.json({ type: 'about:blank', title: code, status, code, detail }, { status, headers: { 'content-type': 'application/problem+json' } });

/**
 * Fixture sign-in for the harness (DR-012, DR-014), test mode only: the only browser-facing API
 * route. Forwards to the Node service and sets the session it issued as a first-party cookie.
 */
export async function POST(request: Request): Promise<Response> {
    if (!testMode()) return problem(404, 'NOT_FOUND', 'No route for POST /api/v1/session');
    const jar = await cookies();
    const namespace = request.headers.get('x-test-namespace') ?? jar.get(NAMESPACE_COOKIE)?.value;
    const body = (await request.json().catch(() => ({}))) as { username?: unknown };
    const result = await fixtureSession(typeof body.username === 'string' ? body.username : '', namespace);
    if (result.status !== 204 || !result.session) {
        return new Response(result.body, { status: result.status, headers: { 'content-type': 'application/problem+json' } });
    }
    jar.set(SESSION_COOKIE, result.session, { httpOnly: true, sameSite: 'lax', path: '/' });
    return new Response(null, { status: 204 });
}
