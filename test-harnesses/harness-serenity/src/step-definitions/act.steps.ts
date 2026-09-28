import { Given, When } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';

import { TheApplication } from '../screenplay/questions/TheApplication.js';
import { RegisterApplicant } from '../screenplay/tasks/Arrange.js';
import { CarryOut, Force, type CommandName } from '../screenplay/tasks/Commands.js';
import { Fixtures, type Fixture } from '../screenplay/tasks/Fixtures.js';
import { SubmitApplication } from '../screenplay/tasks/Submit.js';
import { STAGE_MANAGER, VISITOR } from '../support/serenity.js';

When(
    '{actor} submits an application for {money} over {int} months with a monthly repayment of {money}',
    (name: string, amount: string, termMonths: number, monthlyRepayment: string) =>
        actorCalled(name).attemptsTo(SubmitApplication.for({ amount, termMonths, monthlyRepayment })),
);

// Preconditions: arranged through the engine or API on every surface.
async function haveSubmitted(name: string, fixture: Fixture) {
    await actorCalled(STAGE_MANAGER).attemptsTo(RegisterApplicant.with(fixture.applicant));
    await actorCalled(name).attemptsTo(
        SubmitApplication.asPrecondition(fixture.terms),
        Ensure.that(TheApplication.status(), equals(fixture.expectedStatus)),
    );
}

Given('{actor} has submitted an application for {money} that is awaiting approval', (name: string, amount: string) =>
    haveSubmitted(name, Fixtures.acceptedApplicationFor(amount)),
);
Given('{actor} has submitted an application that was referred', (name: string) =>
    haveSubmitted(name, Fixtures.referredApplication()),
);
Given('{actor} has submitted an application that was declined', (name: string) =>
    haveSubmitted(name, Fixtures.declinedApplication()),
);

Given('{actor} has approved the application', (name: string) =>
    actorCalled(name).attemptsTo(CarryOut.asPrecondition('approve')),
);
Given('{actor} has declined the application with the reason {string}', (name: string, reason: string) =>
    actorCalled(name).attemptsTo(CarryOut.asPrecondition('decline', reason)),
);
Given('{actor} has requested a human review of the application', (name: string) =>
    actorCalled(name).attemptsTo(CarryOut.asPrecondition('request human review')),
);

When('{actor} approves the application', (name: string) => actorCalled(name).attemptsTo(CarryOut.the('approve')));
When('{actor} declines the application with the reason {string}', (name: string, reason: string) =>
    actorCalled(name).attemptsTo(CarryOut.the('decline', reason)),
);
When('{actor} withdraws the application', (name: string) => actorCalled(name).attemptsTo(CarryOut.the('withdraw')));
When('{actor} requests a human review of the application', (name: string) =>
    actorCalled(name).attemptsTo(CarryOut.the('request human review')),
);

const COMMANDS: readonly CommandName[] = ['approve', 'decline', 'withdraw', 'request human review'];
function asCommand(value: string): CommandName {
    if (!(COMMANDS as readonly string[]).includes(value)) throw new Error(`Unknown command ${value}`);
    return value as CommandName;
}

When('{actor} forces the {string} command on the application', (name: string, command: string) =>
    actorCalled(name).attemptsTo(Force.the(asCommand(command))),
);
When('a visitor who is not signed in forces the {string} command on the application', (command: string) =>
    actorCalled(VISITOR).attemptsTo(Force.the(asCommand(command))),
);
