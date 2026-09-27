import { After, Before, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { Cast, configure, engage } from '@serenity-js/core';
import { ConsoleReporter } from '@serenity-js/console-reporter';

import { ControlTheTestEnvironment } from '../screenplay/abilities/ControlTheTestEnvironment.js';
import { resetScenario } from '../screenplay/ScenarioState.js';
import { openSession, surfaceName } from './surfaces.js';

export const STAGE_MANAGER = 'Stage Manager';
export const VISITOR = 'Visitor';

setDefaultTimeout(30_000);

BeforeAll(() => {
    configure({
        crew: [ConsoleReporter.fromJSON({ theme: 'auto' })],
    });
});

Before(async () => {
    resetScenario();
    const session = await openSession(surfaceName());
    engage(
        Cast.where((actor) => {
            if (actor.name === STAGE_MANAGER) {
                return actor.whoCan(ControlTheTestEnvironment.using(session.control));
            }
            return actor.whoCan(session.workbenchFor(actor.name === VISITOR ? undefined : actor.name));
        }),
    );
});

After(() => {
    resetScenario();
});
