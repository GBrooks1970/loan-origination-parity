import { Then, When } from '@cucumber/cucumber';
import { actorCalled, Interaction, Question, type UsesAbilities } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';

import { UseTheScreens } from '../screenplay/abilities/UseTheScreens.js';
import { scenario } from '../screenplay/ScenarioState.js';

/**
 * ui-only/ steps (spec §10.2). They run on browser surfaces only; the folder decides reach (DR-006).
 * Then-steps here are asked by whoever last looked at a screen.
 */

const screens = (actor: UsesAbilities) => UseTheScreens.as(actor);

const looksAt = (name: string, description: string, action: (s: UseTheScreens) => Promise<unknown>) => {
    scenario().viewer = name;
    return actorCalled(name).attemptsTo(
        Interaction.where(`#actor ${description}`, async (actor) => {
            await action(screens(actor));
        }),
    );
};

const viewer = () => {
    const name = scenario().viewer;
    if (!name) throw new Error('Nobody has viewed a page in this scenario');
    return actorCalled(name);
};

When('{actor} views the application', (name: string) =>
    looksAt(name, 'views the application', (s) => s.ui.viewApplication(s.username, scenario().requireApplicationId())),
);

When('{actor} views the application queue', (name: string) =>
    looksAt(name, 'views the application queue', (s) => s.ui.viewQueue(s.username)),
);

When(
    /^([A-Z][a-z]+) views the (application queue|new application|application detail|audit trail|decline notice) page$/,
    (name: string, page: string) =>
        looksAt(name, `views the ${page} page`, (s) => s.ui.view(s.username, page, scenario().currentApplicationId)),
);

When(
    '{actor} submits an application for {money} over {int} months with a monthly repayment of {money} using only the keyboard',
    (name: string, amount: string, termMonths: number, monthlyRepayment: string) =>
        looksAt(name, 'submits an application using only the keyboard', async (s) => {
            const state = scenario();
            const applicant = state.pendingApplicant;
            if (!applicant) throw new Error('Register an applicant before submitting an application');
            state.observer = s.username;
            const created = await s.ui.submitWithKeyboard(s.username, { applicant, amount, termMonths, monthlyRepayment });
            state.currentApplicationId = created.id;
        }),
);

const actionState = (action: string) =>
    Question.about(`whether "${action}" is offered`, async (actor) => {
        const s = screens(actor);
        const state = await s.ui.actionState(s.username, action);
        return state.offered ? 'offered' : `unavailable because ${state.reason ?? 'no marker'}`;
    });

Then('the {string} action is offered', (action: string) =>
    viewer().attemptsTo(Ensure.that(actionState(action), equals('offered'))),
);

Then('the {string} action is unavailable because {string}', (action: string, code: string) =>
    viewer().attemptsTo(Ensure.that(actionState(action), equals(`unavailable because ${code}`))),
);

Then('the page has no accessibility violations of serious or critical impact', () =>
    viewer().attemptsTo(
        Ensure.that(
            Question.about('serious or critical accessibility violations', async (actor) => {
                const s = screens(actor);
                return (await s.ui.accessibilityViolations(s.username)).join('; ') || 'none';
            }),
            equals('none'),
        ),
    ),
);

const DISPLAYED: Record<string, string> = {
    amount: 'amount',
    'monthly repayment': 'monthly-repayment',
    'debt service ratio': 'dsr',
    'submission time': 'submitted-at',
};

Then(
    /^the (amount|monthly repayment|debt service ratio|submission time) is displayed as "([^"]*)"$/,
    (field: string, text: string) =>
        viewer().attemptsTo(
            Ensure.that(
                Question.about(`the displayed ${field}`, (actor) => {
                    const s = screens(actor);
                    return s.ui.displayedText(s.username, DISPLAYED[field]!);
                }),
                equals(text),
            ),
        ),
);

Then('no errors are written to the browser console', () =>
    viewer().attemptsTo(
        Ensure.that(
            Question.about('browser console errors', async (actor) => {
                const s = screens(actor);
                return (await s.ui.consoleErrors(s.username)).join(' | ') || 'none';
            }),
            equals('none'),
        ),
    ),
);
