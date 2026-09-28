#!/usr/bin/env node
// Measured timings per surface from the Cucumber message streams and set-up summaries in
// test-harnesses/harness-serenity/reports/. Prints a Markdown table, appends it to the GitHub
// Actions job summary when running in CI, and writes reports/timings-summary.json.
// Nothing here is estimated: every figure comes from timestamps the run itself recorded.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const reports = new URL('../test-harnesses/harness-serenity/reports/', import.meta.url).pathname;
const SURFACES = ['core', 'api', 'angular', 'nextjs'];

const millis = (t) => t.seconds * 1000 + t.nanos / 1e6;
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];

function measure(surface) {
    const file = join(reports, `${surface}.ndjson`);
    if (!existsSync(file)) return undefined;
    let runStarted;
    let runFinished;
    const started = new Map();
    const durations = [];
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const m = JSON.parse(line);
        if (m.testRunStarted) runStarted = millis(m.testRunStarted.timestamp);
        if (m.testRunFinished) runFinished = millis(m.testRunFinished.timestamp);
        if (m.testCaseStarted) started.set(m.testCaseStarted.id, millis(m.testCaseStarted.timestamp));
        if (m.testCaseFinished) durations.push(millis(m.testCaseFinished.timestamp) - started.get(m.testCaseFinished.testCaseStartedId));
    }
    durations.sort((a, b) => a - b);
    const setupFile = join(reports, `setup-timings-${surface}.json`);
    const setup = existsSync(setupFile) ? JSON.parse(readFileSync(setupFile, 'utf8')) : undefined;
    return {
        surface,
        scenarios: durations.length,
        suiteSeconds: Number(((runFinished - runStarted) / 1000).toFixed(1)),
        scenarioP50Ms: Math.round(quantile(durations, 0.5)),
        scenarioP95Ms: Math.round(quantile(durations, 0.95)),
        scenarioMaxMs: Math.round(durations.at(-1)),
        setupP50Ms: setup?.p50Ms ?? null,
        setupP95Ms: setup?.p95Ms ?? null,
    };
}

const rows = SURFACES.map(measure).filter(Boolean);
const cell = (v, unit) => (v === null ? '—' : `${v}${unit}`);
const table = [
    '| Surface | Scenarios | Suite | Scenario p50 | Scenario p95 | Scenario max | Set-up p50 | Set-up p95 |',
    '| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(
        (r) =>
            `| ${r.surface} | ${r.scenarios} | ${r.suiteSeconds} s | ${r.scenarioP50Ms} ms | ${r.scenarioP95Ms} ms | ${r.scenarioMaxMs} ms | ${cell(r.setupP50Ms, ' ms')} | ${cell(r.setupP95Ms, ' ms')} |`,
    ),
].join('\n');

console.log(table);
writeFileSync(join(reports, 'timings-summary.json'), JSON.stringify(rows, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Measured timings\n\n${table}\n\nSet-up is the per-scenario test-control cost (spec §11 target: under 200 ms); the core surface has none.\n`);
}
