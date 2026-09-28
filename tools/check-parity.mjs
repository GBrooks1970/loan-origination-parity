#!/usr/bin/env node
// Parity gate (DR-006): per feature folder, every surface that targets the folder must pass
// every scenario, and the passed counts must match each other and the expanded Gherkin count.
// Also fails if any step definition mentions the surface (step definitions must not branch on it).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const reports = join(root, 'test-harnesses/harness-serenity/reports');

/** Which surfaces target which folder (spec §10.1). Next.js joins in Phase 3. */
const REACH = {
    'domain-rules': ['core', 'api', 'angular'],
    workflows: ['api', 'angular'],
    'ui-only': ['angular'],
};

const failures = [];

function results(surface) {
    const file = join(reports, `${surface}.ndjson`);
    if (!existsSync(file)) {
        failures.push(`missing ${relative(root, file)}; run the ${surface} suite first`);
        return new Map();
    }
    const pickles = new Map();
    const testCases = new Map();
    const started = new Map();
    const worst = new Map();
    const rank = { PASSED: 0, SKIPPED: 1, PENDING: 2, UNDEFINED: 3, AMBIGUOUS: 4, FAILED: 5, UNKNOWN: 6 };
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const m = JSON.parse(line);
        if (m.pickle) pickles.set(m.pickle.id, m.pickle.uri);
        if (m.testCase) testCases.set(m.testCase.id, m.testCase.pickleId);
        if (m.testCaseStarted) {
            started.set(m.testCaseStarted.id, m.testCaseStarted.testCaseId);
            worst.set(m.testCaseStarted.id, 'PASSED');
        }
        if (m.testStepFinished) {
            const status = m.testStepFinished.testStepResult.status;
            const id = m.testStepFinished.testCaseStartedId;
            if (rank[status] > rank[worst.get(id)]) worst.set(id, status);
        }
    }
    const perFolder = new Map();
    for (const [startedId, status] of worst) {
        const uri = pickles.get(testCases.get(started.get(startedId)));
        const folder = uri.split('features-shared/')[1].split('/')[0];
        const entry = perFolder.get(folder) ?? { passed: 0, total: 0 };
        entry.total += 1;
        if (status === 'PASSED') entry.passed += 1;
        perFolder.set(folder, entry);
    }
    return perFolder;
}

function expandedScenarioCount(folder) {
    let count = 0;
    const dir = join(root, 'features-shared', folder);
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.feature'))) {
        const lines = readFileSync(join(dir, file), 'utf8').split('\n');
        let inExamples = false;
        let sawHeader = false;
        for (const raw of lines) {
            const line = raw.trim();
            if (/^Scenario:/.test(line)) count += 1;
            if (/^Examples:?/.test(line)) {
                inExamples = true;
                sawHeader = false;
                continue;
            }
            if (inExamples && line.startsWith('|')) {
                if (sawHeader) count += 1;
                else sawHeader = true;
            } else if (inExamples && line && !line.startsWith('#')) {
                inExamples = false;
            }
        }
    }
    return count;
}

const bySurface = Object.fromEntries(['core', 'api', 'angular'].map((s) => [s, results(s)]));
const rows = [];
for (const [folder, surfaces] of Object.entries(REACH)) {
    const expected = expandedScenarioCount(folder);
    for (const surface of surfaces) {
        const r = bySurface[surface].get(folder) ?? { passed: 0, total: 0 };
        rows.push(`${folder.padEnd(14)} ${surface.padEnd(5)} ${String(r.passed).padStart(3)} passed / ${String(r.total).padStart(3)} run / ${expected} in Gherkin`);
        if (r.passed !== expected || r.total !== expected) {
            failures.push(`${folder} on ${surface}: ${r.passed}/${r.total} passed, Gherkin has ${expected}`);
        }
    }
}

const stepDir = join(root, 'test-harnesses/harness-serenity/src/step-definitions');
for (const file of readdirSync(stepDir)) {
    const text = readFileSync(join(stepDir, file), 'utf8');
    if (/SURFACE|surfaceName|CallDomainCore|CallLoanApi|BrowseTheWorkbench|BrowserBackend/.test(text)) {
        failures.push(`step definitions must not branch on surface: ${file}`);
    }
}

console.log(rows.join('\n'));
if (failures.length) {
    console.error(`\nPARITY FAIL\n- ${failures.join('\n- ')}`);
    process.exit(1);
}
console.log('\nPARITY PASS — every targeted surface passes every scenario in its folders; no step definition branches on surface.');
