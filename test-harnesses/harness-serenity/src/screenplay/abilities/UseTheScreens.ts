import { Ability } from '@serenity-js/core';
import type { Page } from 'playwright';

import type { BrowserBackend } from './BrowseTheWorkbench.js';

/**
 * UI-only interactions (spec §10.2): viewing pages, affordances, accessibility, formatting.
 * Held only by actors on browser surfaces; ui-only/ features run nowhere else (DR-006).
 */
export class UseTheScreens extends Ability {
    static using(ui: BrowserBackend, username: string | undefined): UseTheScreens {
        return new UseTheScreens(ui, username);
    }

    constructor(
        readonly ui: BrowserBackend,
        readonly username: string | undefined,
    ) {
        super();
    }

    page(): Promise<Page> {
        return this.ui.pageFor(this.username);
    }
}
