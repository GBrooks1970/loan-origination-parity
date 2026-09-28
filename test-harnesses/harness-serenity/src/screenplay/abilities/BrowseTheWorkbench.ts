import { AxeBuilder } from '@axe-core/playwright';
import type { Browser, BrowserContext, Locator, Page } from 'playwright';
import type {
    Application,
    AuditEvent,
    CreditBand,
    DeclineNotice,
    DeclineReason,
    NewApplication,
    Recommendation,
    RuleResult,
    Status,
} from '@lop/domain-core';

import { Refusal, type WorkbenchBackend } from '../backend.js';
import type { ApiBackend } from './CallLoanApi.js';
import { OperateTheWorkbench } from './OperateTheWorkbench.js';

/**
 * A browser surface: Angular (client-rendered) or Next.js (server-rendered). Commands click the real
 * controls; questions read the rendered data-value attributes (DR-007). Preconditions go through the
 * API. Forced commands (DR-010) go to the API with the SPA's own session on Angular, and replay a
 * captured Server Action form as the forcing actor on Next.js.
 */
export class BrowseTheWorkbench extends OperateTheWorkbench {
    static using(ui: BrowserBackend, username: string | undefined): BrowseTheWorkbench {
        return new BrowseTheWorkbench(ui, username, ui.api, ui.forcedVia());
    }
}

export interface BrowserSettings {
    baseUrl: string;
    surface: string;
    /**
     * `client`: the SPA calls the API from the browser, so a command's outcome is its API response.
     * `server`: Server Actions post/redirect/get, so the outcome is the redirect target (DR-017).
     */
    rendering: 'client' | 'server';
}

/** A Server Action form captured from a rendered page (DR-010): where it posts and what it sends. */
interface CapturedForm {
    routeFor(applicationId: string): string;
    fields: [string, string][];
}

type FormKey = 'submit' | 'approve' | 'decline' | 'withdraw' | 'human-review';

const PAGE_ROUTES: Record<string, (id: string) => string> = {
    'application queue': () => '/applications',
    'new application': () => '/applications/new',
    'application detail': (id) => `/applications/${id}`,
    'audit trail': (id) => `/applications/${id}/audit`,
    'decline notice': (id) => `/applications/${id}/decline-notice`,
};

const ACTION_BUTTON: Record<'approve' | 'withdraw' | 'human-review', string> = {
    approve: 'Approve',
    withdraw: 'Withdraw',
    'human-review': 'Request human review',
};

const VISITOR = '__visitor__';

export class BrowserBackend implements WorkbenchBackend {
    /** Captured once per run and UI: action IDs are fixed for a build, so one capture serves every scenario. */
    private static readonly capturedForms = new Map<string, Promise<Map<FormKey, CapturedForm>>>();

    readonly surface: string;
    private readonly contexts = new Map<string, Promise<{ context: BrowserContext; page: Page; consoleErrors: string[] }>>();

    constructor(
        private readonly browser: Browser,
        readonly api: ApiBackend,
        private readonly settings: BrowserSettings,
    ) {
        this.surface = settings.surface;
    }

    // --- session plumbing ---------------------------------------------------------------------

    /** One browser context per member of staff: separate cookies, fixed en-GB locale and London time. */
    private session(user: string | undefined) {
        const key = user ?? VISITOR;
        let existing = this.contexts.get(key);
        if (!existing) {
            existing = (async () => {
                const context = await this.browser.newContext({
                    baseURL: this.settings.baseUrl,
                    locale: 'en-GB',
                    timezoneId: 'Europe/London',
                });
                await context.addCookies([
                    { name: 'test-namespace', value: this.api.namespace, url: this.settings.baseUrl },
                ]);
                if (user !== undefined) {
                    const res = await context.request.post('/api/v1/session', {
                        data: { username: user },
                        headers: { 'x-test-namespace': this.api.namespace },
                    });
                    if (res.status() !== 204) {
                        throw new Error(`Sign-in for ${user} failed: ${res.status()} ${await res.text()}`);
                    }
                }
                const page = await context.newPage();
                const consoleErrors: string[] = [];
                page.on('console', (message) => {
                    if (message.type() === 'error') consoleErrors.push(message.text());
                });
                page.on('pageerror', (error) => consoleErrors.push(error.message));
                return { context, page, consoleErrors };
            })();
            this.contexts.set(key, existing);
        }
        return existing;
    }

    async pageFor(user: string | undefined): Promise<Page> {
        return (await this.session(user)).page;
    }

    async consoleErrors(user: string | undefined): Promise<string[]> {
        return [...(await this.session(user)).consoleErrors];
    }

    async close(): Promise<void> {
        for (const pending of this.contexts.values()) {
            await (await pending).context.close().catch(() => undefined);
        }
        this.contexts.clear();
    }

    /**
     * DR-010. Client-rendered SPA: the command goes to the API with the SPA's own session cookie.
     * Server-rendered (Next.js): a Server Action form captured at run time is replayed by the actor.
     */
    forcedVia(): WorkbenchBackend {
        if (this.settings.rendering === 'server') return this.forgedForms();
        const post = async (user: string | undefined, path: string, body: unknown = {}) => {
            const { context } = await this.session(user);
            const res = await context.request.post(`/api/v1${path}`, {
                data: body,
                headers: { 'x-test-namespace': this.api.namespace },
            });
            const payload = await res.json().catch(() => undefined);
            if (!res.ok()) {
                if (payload && typeof payload.code === 'string') throw new Refusal(payload.code);
                throw new Error(`Forced POST ${path} failed: ${res.status()}`);
            }
            return payload as Application;
        };
        return {
            surface: `${this.surface} (forced)`,
            submit: (user, input) => post(user, '/applications', input),
            approve: (user, id) => post(user, `/applications/${id}/approve`),
            decline: (user, id, reason) => post(user, `/applications/${id}/decline`, { reason }),
            withdraw: (user, id) => post(user, `/applications/${id}/withdraw`),
            requestHumanReview: (user, id) => post(user, `/applications/${id}/human-review`),
            get: (user, id) => this.get(user, id),
            list: (user) => this.list(user),
            auditTrail: (user, id) => this.auditTrail(user, id),
            declineNotice: (user, id) => this.declineNotice(user, id),
        };
    }

    // --- commands through the screens ------------------------------------------------------------

    async submit(user: string | undefined, input: NewApplication): Promise<Application> {
        const page = await this.pageFor(user);
        await page.goto('/applications/new');
        await this.fillApplication(page, input);
        const outcome = this.commandOutcome(page, (r) => r.url().endsWith('/api/v1/applications') && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'Submit application', exact: true }).click();
        const created = (await outcome) as Application;
        await page.waitForURL((url) => url.pathname === `/applications/${created.id}`);
        return this.get(user, created.id);
    }

    /** Keyboard-only variant (ui-only/accessibility): Tab to each field, type, Enter on submit. */
    async submitWithKeyboard(user: string | undefined, input: NewApplication): Promise<Application> {
        const page = await this.pageFor(user);
        await page.goto('/applications/new');
        await page.getByLabel('Applicant reference', { exact: true }).waitFor();
        for (let i = 0; i < 20 && (await page.evaluate(() => document.activeElement?.id)) !== 'applicantRef'; i += 1) {
            await page.keyboard.press('Tab');
        }
        const values = this.fieldValues(input);
        for (const [index, [, value]] of values.entries()) {
            await page.keyboard.type(value);
            if (index < values.length - 1) await page.keyboard.press('Tab');
        }
        await page.keyboard.press('Tab');
        const outcome = this.commandOutcome(page, (r) => r.url().endsWith('/api/v1/applications') && r.request().method() === 'POST');
        await page.keyboard.press('Enter');
        const created = (await outcome) as Application;
        await page.waitForURL((url) => url.pathname === `/applications/${created.id}`);
        return this.get(user, created.id);
    }

    approve = (user: string | undefined, id: string) => this.clickAction(user, id, 'approve');
    withdraw = (user: string | undefined, id: string) => this.clickAction(user, id, 'withdraw');
    requestHumanReview = (user: string | undefined, id: string) => this.clickAction(user, id, 'human-review');

    async decline(user: string | undefined, id: string, reason: string): Promise<Application> {
        const page = await this.openDetail(user, id);
        await this.requireButton(page, 'Decline');
        await page.getByRole('button', { name: 'Decline', exact: true }).click();
        await page.getByLabel('Reason', { exact: true }).fill(reason);
        const outcome = this.commandOutcome(page, (r) => r.url().endsWith(`/${id}/decline`) && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'Confirm decline', exact: true }).click();
        await outcome;
        return this.get(user, id);
    }

    // --- reads from the rendered pages -------------------------------------------------------------

    async get(user: string | undefined, id: string): Promise<Application> {
        const page = await this.pageFor(user);
        await page.goto(`/applications/${id}`);
        await this.settled(page, '[data-testid="status"]');
        const value = (testid: string) => this.dataValue(page.locator(`dd[data-testid="${testid}"]`));
        const rows = page.locator('[data-testid="rule-result"]');
        const ruleResults: RuleResult[] = [];
        for (let i = 0; i < (await rows.count()); i += 1) {
            const row = rows.nth(i);
            ruleResults.push({
                rule: (await row.getAttribute('data-rule')) as RuleResult['rule'],
                result: (await row.getAttribute('data-result')) as RuleResult['result'],
                observed: String(await row.getAttribute('data-observed')),
                threshold: String(await row.getAttribute('data-threshold')),
            });
        }
        const decisionType = await value('decision-type');
        const decidedBy = await value('decided-by');
        const reasons = await value('decline-reasons');
        const reopenedAt = await value('reopened-at');
        return {
            id,
            applicant: { applicantRef: '', dateOfBirth: '', netMonthlyIncome: '', monthlyCreditCommitments: '', essentialMonthlyExpenditure: '' },
            status: (await value('status')) as Status,
            decisionType: decisionType ? (decisionType as Application['decisionType']) : null,
            recommendation: (await value('recommendation')) as Recommendation,
            creditBand: (await value('credit-band')) as CreditBand,
            debtServiceRatio: await value('dsr'),
            ruleResults,
            declineReasons: reasons ? (reasons.split(', ') as DeclineReason[]) : [],
            amount: await value('amount'),
            termMonths: Number(await value('term')),
            monthlyRepayment: await value('monthly-repayment'),
            createdBy: await value('created-by'),
            decidedBy: decidedBy || null,
            submittedAt: await value('submitted-at'),
            decidedAt: null,
            humanReviewRequested: reopenedAt !== '',
            reopenedAt: reopenedAt || null,
            ruleSetVersion: await value('rule-set-version'),
        };
    }

    async list(user: string | undefined): Promise<Application[]> {
        const page = await this.pageFor(user);
        const loaded = this.pageData(page, (r) => r.url().endsWith('/api/v1/applications') && r.request().method() === 'GET');
        await page.goto('/applications');
        await loaded;
        const rows = page.locator('[data-testid="application-row"]');
        await page.locator('table tbody tr').first().waitFor();
        const ids = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-id') ?? ''));
        return ids.map((id) => ({ id }) as Application);
    }

    async auditTrail(user: string | undefined, id: string): Promise<AuditEvent[]> {
        const page = await this.pageFor(user);
        const loaded = this.pageData(page, (r) => r.url().endsWith(`/${id}/audit`));
        await page.goto(`/applications/${id}/audit`);
        await loaded;
        await page.locator('[data-testid="audit-event"]').first().waitFor();
        return page.locator('[data-testid="audit-event"]').evaluateAll((rows) =>
            rows.map((row, index) => ({
                sequence: index + 1,
                type: row.getAttribute('data-type'),
                at: '',
                actor: row.getAttribute('data-actor'),
                applicationId: null,
                payload: JSON.parse(row.getAttribute('data-payload') ?? '{}'),
            })),
        ) as Promise<AuditEvent[]>;
    }

    async declineNotice(user: string | undefined, id: string): Promise<DeclineNotice> {
        const page = await this.pageFor(user);
        await page.goto(`/applications/${id}/decline-notice`);
        await this.settled(page, '[data-testid="human-review-offer"]');
        const reasons = await page
            .locator('[data-testid="decline-reason"]')
            .evaluateAll((items) => items.map((li) => ({ code: li.getAttribute('data-code'), text: li.textContent?.trim() ?? '' })));
        const agency = await this.dataValue(page.locator('[data-testid="agency"]'));
        return {
            applicationId: id,
            reasons: reasons as DeclineNotice['reasons'],
            creditReferenceAgencyDisclosed: agency !== '',
            creditReferenceAgencyName: agency || null,
            humanReviewAvailable: (await this.dataValue(page.locator('[data-testid="human-review-offer"]'))) === 'true',
        };
    }

    // --- UI-only -------------------------------------------------------------------------------

    async view(user: string | undefined, page: string, id: string | undefined): Promise<void> {
        const route = PAGE_ROUTES[page];
        if (!route) throw new Error(`Unknown page "${page}"`);
        const p = await this.pageFor(user);
        await p.goto(route(id ?? ''));
        await p.locator('h1').first().waitFor();
        await p.waitForLoadState('networkidle');
    }

    async viewApplication(user: string | undefined, id: string): Promise<void> {
        await this.openDetail(user, id);
    }

    async viewQueue(user: string | undefined): Promise<void> {
        const page = await this.pageFor(user);
        await page.goto('/applications');
        await page.locator('[data-testid="action-unavailable"], a:text-is("New application")').first().waitFor();
    }

    async actionState(user: string | undefined, action: string): Promise<{ offered: boolean; reason: string | null }> {
        const page = await this.pageFor(user);
        const control = page.getByRole(action === 'New application' ? 'link' : 'button', { name: action, exact: true });
        if (await control.count()) {
            return { offered: await control.isEnabled(), reason: null };
        }
        const marker = page.locator(`[data-testid="action-unavailable"][data-action="${action}"]`);
        return { offered: false, reason: (await marker.count()) ? await marker.getAttribute('data-reason') : null };
    }

    async accessibilityViolations(user: string | undefined): Promise<string[]> {
        const page = await this.pageFor(user);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        return results.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`);
    }

    async displayedText(user: string | undefined, testid: string): Promise<string> {
        const page = await this.pageFor(user);
        return ((await page.locator(`[data-testid="${testid}"]`).first().textContent()) ?? '').trim();
    }

    // --- helpers -------------------------------------------------------------------------------

    private async openDetail(user: string | undefined, id: string): Promise<Page> {
        const page = await this.pageFor(user);
        await page.goto(`/applications/${id}`);
        await this.settled(page, '.actions');
        return page;
    }

    private async clickAction(user: string | undefined, id: string, action: keyof typeof ACTION_BUTTON): Promise<Application> {
        const page = await this.openDetail(user, id);
        const name = ACTION_BUTTON[action];
        await this.requireButton(page, name);
        const path = action === 'human-review' ? 'human-review' : action;
        const outcome = this.commandOutcome(page, (r) => r.url().endsWith(`/${id}/${path}`) && r.request().method() === 'POST');
        await page.getByRole('button', { name, exact: true }).click();
        await outcome;
        return this.get(user, id);
    }

    /** A command the scenario says the actor performs must be on offer; if not, report the UI's reason. */
    private async requireButton(page: Page, name: string): Promise<void> {
        if (await page.getByRole('button', { name, exact: true }).count()) return;
        const marker = page.locator(`[data-testid="action-unavailable"][data-action="${name}"]`);
        throw new Refusal((await marker.count()) ? String(await marker.getAttribute('data-reason')) : 'NOT_OFFERED');
    }

    /**
     * The outcome of a command started by the next click or key press. Client rendering: the API
     * response. Server rendering: the post/redirect/get target, `?done=` or `?refused=<code>` (DR-017).
     */
    private commandOutcome(page: Page, apiCall: (r: import('playwright').Response) => boolean): Promise<unknown> {
        if (this.settings.rendering === 'client') return this.outcomeOf(page, apiCall);
        return page
            .waitForURL((url) => url.searchParams.has('done') || url.searchParams.has('refused'), { timeout: 15_000 })
            .then(() => {
                const url = new URL(page.url());
                const refused = url.searchParams.get('refused');
                if (refused) throw new Refusal(refused);
                return { id: decodeURIComponent(url.pathname.split('/').pop() ?? '') };
            });
    }

    /** Client rendering loads page data from the browser, so wait for that call; server-rendered HTML arrives with it. */
    private pageData(page: Page, apiCall: (r: import('playwright').Response) => boolean): Promise<unknown> {
        return this.settings.rendering === 'client' ? this.outcomeOf(page, apiCall) : Promise.resolve();
    }

    /** Waits for the API response a UI action triggers; a problem+json refusal becomes a Refusal. */
    private async outcomeOf(page: Page, matches: (r: import('playwright').Response) => boolean): Promise<unknown> {
        const response = await page.waitForResponse(matches, { timeout: 15_000 });
        const body = await response.json().catch(() => undefined);
        if (!response.ok()) {
            if (body && typeof body.code === 'string') throw new Refusal(body.code);
            throw new Error(`${response.request().method()} ${response.url()} failed: ${response.status()}`);
        }
        return body;
    }

    /** Waits until the page shows its data or an error; an error becomes a Refusal. */
    private async settled(page: Page, ready: string): Promise<void> {
        await page.locator(`${ready}, [data-testid="error"]`).first().waitFor({ timeout: 15_000 });
        if (!(await page.locator(ready).count())) {
            throw new Refusal(String(await page.locator('[data-testid="error"]').first().getAttribute('data-reason')));
        }
    }

    private async dataValue(locator: Locator): Promise<string> {
        return (await locator.first().getAttribute('data-value')) ?? '';
    }

    // --- DR-010 on Next.js: captured Server Action forms ------------------------------------------

    /**
     * Forcing on Next.js: the actor's own browser context posts a Server Action form captured from a
     * page rendered for a staff member who *is* offered the command. No JavaScript runs, so the post
     * is a plain HTML form submission and the action answers 303 with its outcome in the Location.
     */
    private forgedForms(): WorkbenchBackend {
        const post = async (user: string | undefined, key: FormKey, applicationId: string, values: Record<string, string> = {}) => {
            const form = (await this.formsFor()).get(key);
            if (!form) throw new Error(`No captured form for "${key}"`);
            const fields = Object.fromEntries(form.fields);
            if ('applicationId' in fields) fields.applicationId = applicationId;
            Object.assign(fields, values);
            const { context } = await this.session(user);
            const res = await context.request.post(form.routeFor(applicationId), {
                multipart: fields,
                headers: { origin: this.settings.baseUrl },
                maxRedirects: 0,
            });
            const location = res.headers()['location'];
            if (res.status() !== 303 || !location) {
                throw new Error(`Forged "${key}" form: expected a 303 redirect, got ${res.status()}`);
            }
            const target = new URL(location, this.settings.baseUrl);
            const refused = target.searchParams.get('refused');
            if (refused) throw new Refusal(refused);
            return { id: decodeURIComponent(target.pathname.split('/').pop() ?? '') } as Application;
        };
        return {
            surface: `${this.surface} (forced)`,
            submit: (user, input) => post(user, 'submit', '', Object.fromEntries(this.fieldNames(input))),
            approve: (user, id) => post(user, 'approve', id),
            decline: (user, id, reason) => post(user, 'decline', id, { reason }),
            withdraw: (user, id) => post(user, 'withdraw', id),
            requestHumanReview: (user, id) => post(user, 'human-review', id),
            get: (user, id) => this.get(user, id),
            list: (user) => this.list(user),
            auditTrail: (user, id) => this.auditTrail(user, id),
            declineNotice: (user, id) => this.declineNotice(user, id),
        };
    }

    private formsFor(): Promise<Map<FormKey, CapturedForm>> {
        let forms = BrowserBackend.capturedForms.get(this.settings.baseUrl);
        if (!forms) {
            forms = this.captureForms();
            forms.catch(() => BrowserBackend.capturedForms.delete(this.settings.baseUrl));
            BrowserBackend.capturedForms.set(this.settings.baseUrl, forms);
        }
        return forms;
    }

    /**
     * Renders every command form for staff who are offered it, in a separate donor namespace so the
     * scenario's own data and audit trail are untouched, and reads each form from the DOM.
     */
    private async captureForms(): Promise<Map<FormKey, CapturedForm>> {
        const donor = this.api.sibling();
        const ui = new BrowserBackend(this.browser, donor, this.settings);
        const forms = new Map<FormKey, CapturedForm>();
        try {
            await donor.setClock('2026-10-01T09:00:00Z');
            await donor.setStaff([
                { username: 'Olivia', role: 'LOAN_OFFICER' },
                { username: 'Sam', role: 'SENIOR_UNDERWRITER' },
            ]);
            await donor.setCreditScore('donor-open', 800);
            await donor.setCreditScore('donor-declined', 500);
            const application = (applicantRef: string): NewApplication => ({
                applicant: {
                    applicantRef,
                    dateOfBirth: '1991-03-15',
                    netMonthlyIncome: '3000.00',
                    monthlyCreditCommitments: '450.00',
                    essentialMonthlyExpenditure: '1200.00',
                },
                amount: '5000.00',
                termMonths: 36,
                monthlyRepayment: '300.00',
            });
            const open = await donor.submit('Olivia', application('donor-open'));
            const declined = await donor.submit('Olivia', application('donor-declined'));
            const capture = async (key: FormKey, user: string, applicationId: string | undefined, button: string, reveal?: string) => {
                const page = await ui.pageFor(user);
                const path = applicationId ? `/applications/${applicationId}` : '/applications/new';
                await page.goto(path);
                if (reveal) await page.getByRole('button', { name: reveal, exact: true }).click();
                const form = page.locator('form').filter({ has: page.getByRole('button', { name: button, exact: true }) });
                await form.waitFor({ timeout: 15_000 });
                const fields = await form.evaluate((element) =>
                    Array.from((element as HTMLFormElement).elements).flatMap((control) => {
                        const { name, value } = control as HTMLInputElement;
                        return name ? [[name, value] as [string, string]] : [];
                    }),
                );
                if (!fields.some(([name]) => name.startsWith('$ACTION_'))) {
                    throw new Error(`The "${button}" form carries no Server Action reference`);
                }
                forms.set(key, {
                    routeFor: (id) => (applicationId ? `/applications/${encodeURIComponent(id)}` : path),
                    fields,
                });
            };
            await capture('submit', 'Olivia', undefined, 'Submit application');
            await capture('withdraw', 'Olivia', open.id, 'Withdraw');
            await capture('approve', 'Sam', open.id, 'Approve');
            await capture('decline', 'Sam', open.id, 'Confirm decline', 'Decline');
            await capture('human-review', 'Olivia', declined.id, 'Request human review');
            return forms;
        } finally {
            await ui.close();
            await donor.dispose();
        }
    }

    private fieldNames(input: NewApplication): [string, string][] {
        return [
            ['applicantRef', input.applicant.applicantRef],
            ['dateOfBirth', input.applicant.dateOfBirth],
            ['netMonthlyIncome', input.applicant.netMonthlyIncome],
            ['monthlyCreditCommitments', input.applicant.monthlyCreditCommitments],
            ['essentialMonthlyExpenditure', input.applicant.essentialMonthlyExpenditure],
            ['amount', input.amount],
            ['termMonths', String(input.termMonths)],
            ['monthlyRepayment', input.monthlyRepayment],
        ];
    }

    private fieldValues(input: NewApplication): [string, string][] {
        return [
            ['Applicant reference', input.applicant.applicantRef],
            ['Date of birth (YYYY-MM-DD)', input.applicant.dateOfBirth],
            ['Net monthly income (£)', input.applicant.netMonthlyIncome],
            ['Monthly credit commitments (£)', input.applicant.monthlyCreditCommitments],
            ['Essential monthly expenditure (£)', input.applicant.essentialMonthlyExpenditure],
            ['Loan amount (£)', input.amount],
            ['Term (months)', String(input.termMonths)],
            ['Monthly repayment (£)', input.monthlyRepayment],
        ];
    }

    private async fillApplication(page: Page, input: NewApplication): Promise<void> {
        for (const [label, value] of this.fieldValues(input)) {
            await page.getByLabel(label, { exact: true }).fill(value);
        }
    }
}
