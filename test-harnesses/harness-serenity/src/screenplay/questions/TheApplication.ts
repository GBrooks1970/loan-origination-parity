import { Question } from '@serenity-js/core';
import type { Application, AuditEvent, DeclineNotice, RuleResult } from '@lop/domain-core';

import { OperateTheWorkbench } from '../abilities/OperateTheWorkbench.js';
import { scenario } from '../ScenarioState.js';

/** Every read is fresh, so lazy expiry and state changes by other actors are always visible. */
const current = (actor: Parameters<typeof OperateTheWorkbench.as>[0]): Promise<Application> =>
    OperateTheWorkbench.as(actor).application(scenario().requireApplicationId());

export const TheApplication = {
    status: () => Question.about('the application status', async (actor) => (await current(actor)).status),
    recommendation: () =>
        Question.about('the recommendation', async (actor) => (await current(actor)).recommendation),
    creditBand: () => Question.about('the credit band', async (actor) => (await current(actor)).creditBand),
    debtServiceRatio: () =>
        Question.about('the debt service ratio', async (actor) => (await current(actor)).debtServiceRatio),
    decisionType: () =>
        Question.about('the decision type', async (actor) => String((await current(actor)).decisionType)),
    ruleSetVersion: () =>
        Question.about('the rule set version', async (actor) => (await current(actor)).ruleSetVersion),
    createdBy: () => Question.about('who created the application', async (actor) => (await current(actor)).createdBy),
    decidedBy: () =>
        Question.about('who decided the application', async (actor) => String((await current(actor)).decidedBy)),
    declineReasons: () =>
        Question.about('the decline reasons', async (actor) => (await current(actor)).declineReasons.join(', ')),
};

export const TheLastRefusal = {
    code: () => Question.about('the refusal code', () => String(scenario().lastRefusal ?? 'none')),
};

export const TheApplications = {
    count: () =>
        Question.about('the number of applications', async (actor) => (await OperateTheWorkbench.as(actor).applications()).length),
};

const events = (actor: Parameters<typeof OperateTheWorkbench.as>[0]): Promise<AuditEvent[]> =>
    OperateTheWorkbench.as(actor).auditTrail(scenario().requireApplicationId());

export const TheAuditTrail = {
    ruleResults: () =>
        Question.about('the recorded rule results', async (actor): Promise<RuleResult[]> =>
            (await events(actor))
                .filter((e) => e.type === 'RULE_EVALUATED')
                .map((e) => e.payload as unknown as RuleResult),
        ),
    events: () => Question.about('the audit trail', (actor) => events(actor)),
};

export const TheDeclineNotice = {
    content: () =>
        Question.about('the decline notice', (actor): Promise<DeclineNotice> =>
            OperateTheWorkbench.as(actor).declineNotice(scenario().requireApplicationId()),
        ),
};
