import { DataTable, Then } from '@cucumber/cucumber';
import { actorCalled, Question } from '@serenity-js/core';
import { contain, Ensure, equals, includes, isFalse, isTrue, not } from '@serenity-js/assertions';

import {
    TheApplication,
    TheApplications,
    TheAuditTrail,
    TheDeclineNotice,
    TheLastRefusal,
} from '../screenplay/questions/TheApplication.js';
import { scenario } from '../screenplay/ScenarioState.js';

/** Then-steps are asked by whoever created the application, so every read is authorised (spec §12). */
const observer = () => {
    const name = scenario().observer;
    if (!name) throw new Error('Nobody has submitted an application in this scenario');
    return actorCalled(name);
};

Then('the recommendation is {string}', (value: string) =>
    observer().attemptsTo(Ensure.that(TheApplication.recommendation(), equals(value))),
);
Then('the credit band is {string}', (value: string) =>
    observer().attemptsTo(Ensure.that(TheApplication.creditBand(), equals(value))),
);
Then('the debt service ratio is {money} percent', (value: string) =>
    observer().attemptsTo(Ensure.that(TheApplication.debtServiceRatio(), equals(value))),
);
Then('the application status is {string}', (value: string) =>
    observer().attemptsTo(Ensure.that(TheApplication.status(), equals(value))),
);
Then('the decision type is {string}', (value: string) =>
    observer().attemptsTo(Ensure.that(TheApplication.decisionType(), equals(value))),
);
Then('the evaluation used rule set {string}', (value: string) =>
    observer().attemptsTo(Ensure.that(TheApplication.ruleSetVersion(), equals(value))),
);
Then('the decline reasons are {string}', (value: string) =>
    observer().attemptsTo(Ensure.that(TheApplication.declineReasons(), equals(value === 'none' ? '' : value))),
);
Then('the application was created by {actor}', (name: string) =>
    observer().attemptsTo(Ensure.that(TheApplication.createdBy(), equals(name))),
);
Then('the application was decided by {actor}', (name: string) =>
    observer().attemptsTo(Ensure.that(TheApplication.decidedBy(), equals(name))),
);

Then('the submission is refused with reason {string}', (code: string) =>
    observer().attemptsTo(Ensure.that(TheLastRefusal.code(), equals(code))),
);
Then('the command is refused with reason {string}', (code: string) =>
    observer().attemptsTo(Ensure.that(TheLastRefusal.code(), equals(code))),
);
Then('no application has been created', () =>
    observer().attemptsTo(Ensure.that(TheApplications.count(), equals(0))),
);

Then('the audit trail records the rule results:', (table: DataTable) =>
    observer().attemptsTo(
        ...table.hashes().map((row) =>
            Ensure.that(
                Question.about(`the recorded result for ${row.rule}`, async (actor) => {
                    const found = (await TheAuditTrail.ruleResults().answeredBy(actor)).find((r) => r.rule === row.rule);
                    return found ? `${found.result} ${found.observed} ${found.threshold}` : 'not recorded';
                }),
                equals(`${row.result} ${row.observed} ${row.threshold}`),
            ),
        ),
    ),
);

const eventSummaries = () =>
    Question.about('the audit trail events', async (actor) =>
        (await TheAuditTrail.events().answeredBy(actor)).map((e) => {
            const p = e.payload as Record<string, unknown>;
            switch (e.type) {
                case 'AUTHORISATION_DENIED':
                    return `denied ${String(p.command)} by ${e.actor} with ${String(p.code)}`;
                case 'STATUS_CHANGED':
                    return `status ${String(p.from)} -> ${String(p.to)} by ${e.actor}`;
                case 'HUMAN_REVIEW_REQUESTED':
                    return `human review requested by ${e.actor}`;
                default:
                    return e.type;
            }
        }),
    );

Then('the audit trail records a denied {string} by {actor} with reason {string}', (command: string, name: string, code: string) =>
    observer().attemptsTo(Ensure.that(eventSummaries(), contain(`denied ${command} by ${name} with ${code}`))),
);
Then('the audit trail records a status change from {string} to {string} by {string}', (from: string, to: string, by: string) =>
    observer().attemptsTo(Ensure.that(eventSummaries(), contain(`status ${from} -> ${to} by ${by}`))),
);
Then('the audit trail records a human review request by {actor}', (name: string) =>
    observer().attemptsTo(Ensure.that(eventSummaries(), contain(`human review requested by ${name}`))),
);

Then('the decline notice gives the reasons:', (table: DataTable) =>
    observer().attemptsTo(
        Ensure.that(
            Question.about('the decline notice reasons', async (actor) =>
                (await TheDeclineNotice.content().answeredBy(actor)).reasons.map((r) => `${r.code}: ${r.text}`),
            ),
            equals(table.hashes().map((row) => `${row.code}: ${row.text}`)),
        ),
    ),
);
Then('the decline notice names the credit reference agency {string}', (name: string) =>
    observer().attemptsTo(
        Ensure.that(
            Question.about('the named agency', async (actor) =>
                String((await TheDeclineNotice.content().answeredBy(actor)).creditReferenceAgencyName),
            ),
            equals(name),
        ),
    ),
);
Then('the decline notice does not name a credit reference agency', () =>
    observer().attemptsTo(
        Ensure.that(
            Question.about('whether an agency is disclosed', async (actor) =>
                (await TheDeclineNotice.content().answeredBy(actor)).creditReferenceAgencyDisclosed,
            ),
            isFalse(),
        ),
    ),
);
const offersReview = () =>
    Question.about('whether the notice offers a human review', async (actor) =>
        (await TheDeclineNotice.content().answeredBy(actor)).humanReviewAvailable,
    );
Then('the decline notice offers a human review', () => observer().attemptsTo(Ensure.that(offersReview(), isTrue())));
Then('the decline notice does not offer a human review', () =>
    observer().attemptsTo(Ensure.that(offersReview(), isFalse())),
);
Then('the decline notice does not contain {string}', (text: string) =>
    observer().attemptsTo(
        Ensure.that(
            Question.about('the decline notice text', async (actor) =>
                JSON.stringify(await TheDeclineNotice.content().answeredBy(actor)),
            ),
            not(includes(text)),
        ),
    ),
);
