import { Ability } from '@serenity-js/core';

import type { TestControlBackend } from '../backend.js';

/** Held by the Stage Manager: arranges clock, staff and credit reference fixtures (spec §11). */
export class ControlTheTestEnvironment extends Ability {
    static using(backend: TestControlBackend): ControlTheTestEnvironment {
        return new ControlTheTestEnvironment(backend);
    }

    constructor(readonly backend: TestControlBackend) {
        super();
    }
}
