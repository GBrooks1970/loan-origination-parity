import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { DomainError, ROLES, httpStatusFor, type Status } from '@lop/domain-core';

import type { ServiceConfig } from './config.js';
import { NamespaceRequired, Namespaces, type Namespace } from './namespaces.js';
import { SESSION_COOKIE, Sessions, readCookie } from './session.js';

/** Structural request shapes only. Semantic validation (money, ranges) stays in domain-core, after authorisation (spec §4.3). */
const NewApplicationBody = z.object({
    applicant: z.object({
        applicantRef: z.string().min(1),
        dateOfBirth: z.iso.date(),
        netMonthlyIncome: z.string(),
        monthlyCreditCommitments: z.string(),
        essentialMonthlyExpenditure: z.string(),
    }),
    amount: z.string(),
    termMonths: z.number().int(),
    monthlyRepayment: z.string(),
});
const DeclineBody = z.object({ reason: z.string() });
const SessionBody = z.object({ username: z.string().min(1) });
const StaffBody = z.array(z.object({ username: z.string().min(1), role: z.enum(ROLES) }));
const ClockBody = z.object({ now: z.iso.datetime({ offset: true }) });
const ScoreBody = z.object({ score: z.number().int().min(0).max(999) });
const STATUSES = ['AWAITING_APPROVAL', 'REFERRED', 'APPROVED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'] as const;

interface Context {
    namespace: Namespace;
    namespaceName: string;
    user: string | undefined;
}

class BadRequest extends Error {}

export function createApp(config: ServiceConfig) {
    const namespaces = new Namespaces(config.testMode);
    const sessions = new Sessions(config.sessionSecret);
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json({ limit: '32kb' }));

    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', testMode: config.testMode });
    });

    const context = (req: Request): Context => {
        const requested = req.header('X-Test-Namespace');
        const namespace = namespaces.resolve(requested);
        const namespaceName = config.testMode ? requested! : 'default';
        const user = sessions.verify(namespaceName, readCookie(req.header('cookie'), SESSION_COOKIE));
        return { namespace, namespaceName, user };
    };

    const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
        const result = schema.safeParse(body);
        if (!result.success) {
            throw new BadRequest(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
        }
        return result.data;
    };

    const api = express.Router();

    if (config.testMode) {
        // Fixture sign-in: exists only in test mode (DR-012).
        api.post('/session', (req, res) => {
            const { namespace, namespaceName } = context(req);
            const { username } = parse(SessionBody, req.body);
            if (!namespace.ports.staff.find(username)) {
                throw new DomainError('UNAUTHENTICATED');
            }
            res.cookie(SESSION_COOKIE, sessions.issue(namespaceName, username), { httpOnly: true, sameSite: 'lax', path: '/' });
            res.status(204).end();
        });
    }

    api.get('/me', (req, res) => {
        const { namespace, user } = context(req);
        const staff = user === undefined ? undefined : namespace.ports.staff.find(user);
        if (!staff) throw new DomainError('UNAUTHENTICATED');
        res.json(staff);
    });

    api.get('/me/actions', (req, res) => {
        const { namespace, user } = context(req);
        res.json(namespace.service.staffActions(user));
    });

    api.get('/applications', (req, res) => {
        const { namespace, user } = context(req);
        const status = req.query.status;
        if (status !== undefined && !STATUSES.includes(status as Status)) {
            throw new BadRequest(`Unknown status ${String(status)}`);
        }
        res.json(namespace.service.list(user, status as Status | undefined));
    });

    api.post('/applications', (req, res) => {
        const { namespace, user } = context(req);
        res.status(201).json(namespace.service.submit(user, parse(NewApplicationBody, req.body)));
    });

    api.get('/applications/:id', (req, res) => {
        const { namespace, user } = context(req);
        res.json(namespace.service.get(user, req.params.id));
    });

    api.post('/applications/:id/approve', (req, res) => {
        const { namespace, user } = context(req);
        res.json(namespace.service.approve(user, req.params.id));
    });

    api.post('/applications/:id/decline', (req, res) => {
        const { namespace, user } = context(req);
        res.json(namespace.service.decline(user, req.params.id, parse(DeclineBody, req.body).reason));
    });

    api.post('/applications/:id/withdraw', (req, res) => {
        const { namespace, user } = context(req);
        res.json(namespace.service.withdraw(user, req.params.id));
    });

    api.post('/applications/:id/human-review', (req, res) => {
        const { namespace, user } = context(req);
        res.json(namespace.service.requestHumanReview(user, req.params.id));
    });

    api.get('/applications/:id/actions', (req, res) => {
        const { namespace, user } = context(req);
        res.json(namespace.service.availableActions(user, req.params.id));
    });

    api.get('/applications/:id/audit', (req, res) => {
        const { namespace, user } = context(req);
        res.json(namespace.service.auditTrail(user, req.params.id));
    });

    api.get('/applications/:id/decline-notice', (req, res) => {
        const { namespace, user } = context(req);
        res.json(namespace.service.declineNotice(user, req.params.id));
    });

    app.use('/api/v1', api);

    if (config.testMode) {
        app.use('/__test__', testControl(namespaces, config.testControlToken!, parse, { StaffBody, ClockBody, ScoreBody }));
    }

    app.use((req, res) => {
        problem(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`);
    });

    app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
        if (error instanceof DomainError) {
            return problem(res, httpStatusFor(error.code), error.code, error.message);
        }
        if (error instanceof NamespaceRequired || error instanceof BadRequest) {
            return problem(res, 400, 'INVALID_REQUEST', error.message);
        }
        if (isJsonSyntaxError(error)) {
            return problem(res, 400, 'INVALID_REQUEST', 'Malformed JSON body');
        }
        console.error(error);
        return problem(res, 500, 'INTERNAL_ERROR', 'Unexpected error');
    });

    return app;
}

function testControl(
    namespaces: Namespaces,
    token: string,
    parse: <T>(schema: z.ZodType<T>, body: unknown) => T,
    schemas: { StaffBody: typeof StaffBody; ClockBody: typeof ClockBody; ScoreBody: typeof ScoreBody },
): Router {
    const router = express.Router();
    router.use((req, res, next) => {
        if (req.header('X-Test-Control-Token') !== token) {
            return problem(res, 401, 'UNAUTHENTICATED', 'Missing or wrong X-Test-Control-Token');
        }
        next();
    });
    const named = (req: Request): string => {
        const name = String(req.params.ns);
        if (!Namespaces.isValid(name)) throw new BadRequest(`Invalid namespace ${name}`);
        return name;
    };
    router.post('/namespaces/:ns/reset', (req, res) => {
        namespaces.reset(named(req));
        res.status(204).end();
    });
    router.put('/namespaces/:ns/staff', (req, res) => {
        namespaces.resolve(named(req)).ports.staff.replace(parse(schemas.StaffBody, req.body));
        res.status(204).end();
    });
    router.put('/namespaces/:ns/clock', (req, res) => {
        namespaces.resolve(named(req)).ports.clock.set(new Date(parse(schemas.ClockBody, req.body).now));
        res.status(204).end();
    });
    router.put('/namespaces/:ns/bureau/:applicantRef', (req, res) => {
        namespaces.resolve(named(req)).ports.bureau.set(String(req.params.applicantRef), parse(schemas.ScoreBody, req.body).score);
        res.status(204).end();
    });
    return router;
}

function problem(res: Response, status: number, code: string, detail: string) {
    res.status(status).type('application/problem+json').json({ type: 'about:blank', title: code, status, code, detail });
}

function isJsonSyntaxError(error: unknown): boolean {
    return error instanceof SyntaxError && 'status' in error && (error as { status: number }).status === 400;
}
