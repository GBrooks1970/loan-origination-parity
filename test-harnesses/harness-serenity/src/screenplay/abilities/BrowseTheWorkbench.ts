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
 * A browser surface (Angular in Phase 2). Commands click the real controls; questions read the
 * rendered data-value attributes (DR-007). Preconditions go through the API, and forced commands
 * go to the API with the browser's own session (DR-010).
 */
export class BrowseTheWorkbench extends OperateTheWorkbench {
    static using(ui: BrowserBackend, username: string | undefined): BrowseTheWorkbench {
        return new BrowseTheWorkbench(ui, username, ui.api, ui.forcedVia());
    }
}

export interface BrowserSettings {
    baseUrl: string;
    surface: string;
}

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

    /** DR-010 on a client-rendered SPA: the command goes to the API with the SPA's own session cookie. */
    forcedVia(): WorkbenchBackend {
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
        const outcome = this.outcomeOf(page, (r) => r.url().endsWith('/api/v1/applications') && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'Submit application', exact: true }).click();
        const created = (await outcome) as Application;
        await page.waitForURL(`**/applications/${created.id}`);
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
        const outcome = this.outcomeOf(page, (r) => r.url().endsWith('/api/v1/applications') && r.request().method() === 'POST');
        await page.keyboard.press('Enter');
        const created = (await outcome) as Application;
        await page.waitForURL(`**/applications/${created.id}`);
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
        const outcome = this.outcomeOf(page, (r) => r.url().endsWith(`/${id}/decline`) && r.request().method() === 'POST');
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
        const loaded = this.outcomeOf(page, (r) => r.url().endsWith('/api/v1/applications') && r.request().method() === 'GET');
        await page.goto('/applications');
        await loaded;
        const rows = page.locator('[data-testid="application-row"]');
        await page.locator('table tbody tr').first().waitFor();
        const ids = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-id') ?? ''));
        return ids.map((id) => ({ id }) as Application);
    }

    async auditTrail(user: string | undefined, id: string): Promise<AuditEvent[]> {
        const page = await this.pageFor(user);
        const loaded = this.outcomeOf(page, (r) => r.url().endsWith(`/${id}/audit`));
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
        const outcome = this.outcomeOf(page, (r) => r.url().endsWith(`/${id}/${path}`) && r.request().method() === 'POST');
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
