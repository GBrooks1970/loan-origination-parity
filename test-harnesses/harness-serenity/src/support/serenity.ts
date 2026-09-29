import { mkdirSync, writeFileSync } from 'node:fs';

import { After, AfterAll, Before, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { Cast, configure, engage } from '@serenity-js/core';
import { ConsoleReporter } from '@serenity-js/console-reporter';

import { ControlTheTestEnvironment } from '../screenplay/abilities/ControlTheTestEnvironment.js';
import { resetScenario } from '../screenplay/ScenarioState.js';
import { closeSharedBrowser, openSession, surfaceName, type SurfaceSession } from './surfaces.js';

export const STAGE_MANAGER = 'Stage Manager';
export const VISITOR = 'Visitor';

setDefaultTimeout(30_000);

BeforeAll(() => {
    configure({
        crew: [
            ConsoleReporter.fromJSON({ theme: 'auto' }),
            // Serenity BDD JSON per surface; tools/build-reports.mjs turns each folder into an HTML report.
            '@serenity-js/serenity-bdd',
            ['@serenity-js/core:ArtifactArchiver', { outputDirectory: `target/site/serenity/${surfaceName()}` }],
        ],
    });
});

let session: SurfaceSession | undefined;
const setupTimings: number[] = [];

Before(async () => {
    resetScenario();
    session = await openSession(surfaceName());
    const current = session;
    engage(
        Cast.where((actor) => {
            if (actor.name === STAGE_MANAGER) {
                return actor.whoCan(ControlTheTestEnvironment.using(current.control));
            }
            const username = actor.name === VISITOR ? undefined : actor.name;
            const screens = current.screensFor?.(username);
            return screens
                ? actor.whoCan(current.workbenchFor(username), screens)
                : actor.whoCan(current.workbenchFor(username));
        }),
    );
});

After(async () => {
    const millis = session?.setupMillis();
    if (millis !== undefined) setupTimings.push(millis);
    await session?.close();
    session = undefined;
    resetScenario();
});

/** Records the measured per-scenario set-up cost (spec §11: target under 200 ms; nothing is claimed unmeasured). */
AfterAll(async () => {
    await closeSharedBrowser();
    if (setupTimings.length === 0) return;
    const sorted = [...setupTimings].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!;
    const summary = {
        surface: surfaceName(),
        scenarios: sorted.length,
        p50Ms: Number(at(0.5).toFixed(2)),
        p95Ms: Number(at(0.95).toFixed(2)),
        maxMs: Number(sorted.at(-1)!.toFixed(2)),
        meanMs: Number((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2)),
    };
    mkdirSync('reports', { recursive: true });
    writeFileSync(`reports/setup-timings-${summary.surface}.json`, JSON.stringify(summary, null, 2));
    console.log(`Per-scenario set-up (${summary.surface}): p50 ${summary.p50Ms} ms, p95 ${summary.p95Ms} ms, max ${summary.maxMs} ms over ${summary.scenarios} scenarios`);
});
