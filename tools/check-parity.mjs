#!/usr/bin/env node
// Parity gate (DR-006): per feature folder, every surface that targets the folder must pass
// every scenario; the passed counts must match each other and the expanded Gherkin count; and the
// passed scenarios must be the same scenarios, compared by feature file, name, step text and step
// arguments. Also fails if any step definition mentions a surface (step definitions must not branch on it).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const reports = join(root, 'test-harnesses/harness-serenity/reports');

/** Which surfaces target which folder (spec §10.1). */
const REACH = {
    'domain-rules': ['core', 'api', 'angular', 'nextjs'],
    workflows: ['api', 'angular', 'nextjs'],
    'ui-only': ['angular', 'nextjs'],
};

const failures = [];

function results(surface) {
    const file = join(reports, `${surface}.ndjson`);
    if (!existsSync(file)) {
        failures.push(`missing ${relative(root, file)}; run the ${surface} suite first`);
        return new Map();
    }
    const pickles = new Map();
    const signatures = new Map();
    const testCases = new Map();
    const started = new Map();
    const worst = new Map();
    const rank = { PASSED: 0, SKIPPED: 1, PENDING: 2, UNDEFINED: 3, AMBIGUOUS: 4, FAILED: 5, UNKNOWN: 6 };
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const m = JSON.parse(line);
        if (m.pickle) {
            pickles.set(m.pickle.id, m.pickle.uri);
            signatures.set(m.pickle.id, signature(m.pickle));
        }
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
        const pickleId = testCases.get(started.get(startedId));
        const folder = pickles.get(pickleId).split('features-shared/')[1].split('/')[0];
        const entry = perFolder.get(folder) ?? { passed: 0, total: 0, scenarios: new Map() };
        entry.total += 1;
        if (status === 'PASSED') {
            entry.passed += 1;
            const key = signatures.get(pickleId);
            entry.scenarios.set(key, (entry.scenarios.get(key) ?? 0) + 1);
        }
        perFolder.set(folder, entry);
    }
    return perFolder;
}

/** A scenario's identity for step-text parity: feature file, name, and every step's text and argument. */
function signature(pickle) {
    const feature = pickle.uri.split('features-shared/')[1];
    const steps = pickle.steps.map((step) => `${step.text}${step.argument ? ` ${JSON.stringify(step.argument)}` : ''}`);
    return [feature, pickle.name, ...steps].join('\n  ');
}

/** Scenarios in `a` that `b` lacks (counting duplicates). */
function missingFrom(a, b) {
    const missing = [];
    for (const [key, count] of a) {
        if ((b.get(key) ?? 0) < count) missing.push(key);
    }
    return missing;
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

const bySurface = Object.fromEntries(['core', 'api', 'angular', 'nextjs'].map((s) => [s, results(s)]));
const rows = [];
for (const [folder, surfaces] of Object.entries(REACH)) {
    const expected = expandedScenarioCount(folder);
    const [reference] = surfaces;
    const referenceScenarios = bySurface[reference].get(folder)?.scenarios ?? new Map();
    for (const surface of surfaces) {
        const r = bySurface[surface].get(folder) ?? { passed: 0, total: 0, scenarios: new Map() };
        const missing = missingFrom(referenceScenarios, r.scenarios);
        const extra = missingFrom(r.scenarios, referenceScenarios);
        const same = missing.length === 0 && extra.length === 0;
        rows.push(
            `${folder.padEnd(14)} ${surface.padEnd(7)} ${String(r.passed).padStart(3)} passed / ${String(r.total).padStart(3)} run / ${expected} in Gherkin · step text ${same ? 'identical to' : 'DIFFERS from'} ${reference}`,
        );
        if (r.passed !== expected || r.total !== expected) {
            failures.push(`${folder} on ${surface}: ${r.passed}/${r.total} passed, Gherkin has ${expected}`);
        }
        for (const [label, list] of [['passed on ' + reference + ' but not on ' + surface, missing], ['passed on ' + surface + ' but not on ' + reference, extra]]) {
            for (const key of list.slice(0, 3)) failures.push(`${folder}: scenario ${label}:\n    ${key}`);
            if (list.length > 3) failures.push(`${folder}: … and ${list.length - 3} more ${label}`);
        }
    }
}

const stepDir = join(root, 'test-harnesses/harness-serenity/src/step-definitions');
for (const file of readdirSync(stepDir)) {
    const text = readFileSync(join(stepDir, file), 'utf8');
    if (/SURFACE|surfaceName|CallDomainCore|CallLoanApi|BrowseTheWorkbench|BrowserBackend|nextjs|angular/.test(text)) {
        failures.push(`step definitions must not branch on surface: ${file}`);
    }
}

console.log(rows.join('\n'));
if (failures.length) {
    console.error(`\nPARITY FAIL\n- ${failures.join('\n- ')}`);
    process.exit(1);
}
console.log('\nPARITY PASS — every targeted surface passes the same scenarios, with identical step text, in each of its folders; no step definition branches on surface.');
