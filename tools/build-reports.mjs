#!/usr/bin/env node
// Builds the published evidence site from one CI run's own artefacts:
// - one Serenity BDD HTML report per surface, from the Serenity/JS JSON the harness wrote to
//   test-harnesses/harness-serenity/target/site/serenity/<surface>/;
// - the parity evidence page (index.html), from tools/evidence-page/, filled with data derived from
//   the same run's Cucumber messages in reports/<surface>.ndjson, the real parity gate's verdict, a
//   negative check of that gate on a tampered copy of the reports, code read from the harness source,
//   and the committed Phase 4 stability evidence. Nothing on the page is typed in by hand.
//
// Needs Java 17+. The Serenity BDD CLI jar ships inside @serenity-js/serenity-bdd, so `npm ci` provides it.
// Output: test-harnesses/harness-serenity/target/site/report/
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const harness = join(root, 'test-harnesses/harness-serenity');
const json = join(harness, 'target/site/serenity');
const reports = join(harness, 'reports');
const site = join(harness, 'target/site/report');
const cacheDir = 'node_modules/@serenity-js/serenity-bdd/cache';

const SURFACES = [
    { id: 'core', label: 'Core' },
    { id: 'api', label: 'API' },
    { id: 'angular', label: 'Angular' },
    { id: 'nextjs', label: 'Next.js' },
];
const KEYWORD = { Context: 'Given', Action: 'When', Outcome: 'Then' };
const RANK = { PASSED: 0, SKIPPED: 1, PENDING: 2, UNDEFINED: 3, AMBIGUOUS: 4, FAILED: 5, UNKNOWN: 6 };

function fail(message) {
    console.error(`build-reports: ${message}`);
    process.exit(1);
}

// --- Serenity BDD reports ----------------------------------------------------------------------

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

const built = {};
for (const surface of SURFACES) {
    const source = join(json, surface.id);
    if (!existsSync(source)) {
        console.log(`build-reports: no Serenity/JS JSON for ${surface.id}; skipped`);
        continue;
    }
    const result = spawnSync(
        'npx',
        [
            'serenity-bdd', 'run',
            '--cacheDir', cacheDir,
            '--source', source,
            '--destination', join(site, surface.id),
            '--features', 'features-shared',
            '--project', `Loan Origination Parity: ${surface.label} surface`,
        ],
        { cwd: root, stdio: 'inherit' },
    );
    if (result.status !== 0 || !existsSync(join(site, surface.id, 'index.html'))) fail(`Serenity BDD CLI failed for ${surface.id}`);
    built[surface.id] = true;
}
if (Object.keys(built).length === 0) fail('no surface had Serenity/JS JSON; run a surface suite first');

// --- Run data from the Cucumber messages -------------------------------------------------------

const millis = (t) => t.seconds * 1000 + t.nanos / 1e6;
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];

function readSurface(surface) {
    const file = join(reports, `${surface}.ndjson`);
    if (!existsSync(file)) return undefined;
    const pickles = new Map();
    const testCases = new Map();
    const started = new Map();
    const worst = new Map();
    const durations = [];
    let runStarted;
    let runFinished;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const m = JSON.parse(line);
        if (m.pickle) pickles.set(m.pickle.id, m.pickle);
        if (m.testCase) testCases.set(m.testCase.id, m.testCase.pickleId);
        if (m.testRunStarted) runStarted = millis(m.testRunStarted.timestamp);
        if (m.testRunFinished) runFinished = millis(m.testRunFinished.timestamp);
        if (m.testCaseStarted) {
            started.set(m.testCaseStarted.id, { testCase: m.testCaseStarted.testCaseId, at: millis(m.testCaseStarted.timestamp) });
            worst.set(m.testCaseStarted.id, 'PASSED');
        }
        if (m.testStepFinished) {
            const { status } = m.testStepFinished.testStepResult;
            const id = m.testStepFinished.testCaseStartedId;
            if (RANK[status] > RANK[worst.get(id)]) worst.set(id, status);
        }
        if (m.testCaseFinished) durations.push(millis(m.testCaseFinished.timestamp) - started.get(m.testCaseFinished.testCaseStartedId).at);
    }
    durations.sort((a, b) => a - b);
    const results = [...worst].map(([id, status]) => ({ pickle: pickles.get(testCases.get(started.get(id).testCase)), status }));
    const timings = durations.length
        ? [Number(((runFinished - runStarted) / 1000).toFixed(1)), Math.round(quantile(durations, 0.5)), Math.round(quantile(durations, 0.95)), Math.round(durations.at(-1))]
        : null;
    return { results, timings };
}

const stepText = (step) => `${step.text}${step.argument ? ` ${JSON.stringify(step.argument)}` : ''}`;

/** Given/When/Then from the pickle step types, with "And" for repeats. */
function withKeywords(steps) {
    let previous;
    return steps.map((step) => {
        const keyword = KEYWORD[step.type] ?? '*';
        const shown = keyword === previous ? 'And' : keyword;
        previous = keyword;
        return `${shown} ${step.text}`;
    });
}

/** Names to roles from a scenario's "the following staff members:" table. */
function staffRoles(pickle) {
    const table = pickle.steps.find((s) => s.text === 'the following staff members:')?.argument?.dataTable;
    if (!table) return {};
    const [header, ...rest] = table.rows.map((r) => r.cells.map((c) => c.value));
    const name = header.indexOf('name');
    const role = header.indexOf('role');
    return Object.fromEntries(rest.map((cells) => [cells[name], cells[role]]));
}

const titles = {};
for (const folder of ['domain-rules', 'workflows', 'ui-only']) {
    for (const file of readdirSync(join(root, 'features-shared', folder)).filter((f) => f.endsWith('.feature'))) {
        const line = readFileSync(join(root, 'features-shared', folder, file), 'utf8').split('\n').find((l) => l.trim().startsWith('Feature:'));
        titles[file.replace('.feature', '')] = line.split(':').slice(1).join(':').trim();
    }
}

const rowsByKey = new Map();
const forcedByKey = new Map();
const runTimings = {};
for (const surface of SURFACES) {
    const data = readSurface(surface.id);
    if (!data) continue;
    runTimings[surface.id] = data.timings;
    for (const { pickle, status } of data.results) {
        const path = pickle.uri.split('features-shared/')[1];
        const [folder, file] = path.split('/');
        const feature = file.replace('.feature', '');
        const key = [path, pickle.name, ...pickle.steps.map(stepText)].join('\n');
        const row = rowsByKey.get(key) ?? { folder, feature, name: pickle.name, steps: withKeywords(pickle.steps), res: {} };
        row.res[surface.id] = status;
        rowsByKey.set(key, row);

        const all = pickle.steps.map((s) => s.text).join('\n');
        const forced = /^(\w+|a visitor who is not signed in) forces the "([^"]+)" command/m.exec(all);
        if (forced) {
            const visitor = forced[1].startsWith('a visitor');
            const entry = forcedByKey.get(key) ?? {
                feature,
                name: pickle.name,
                who: visitor ? 'Visitor' : forced[1],
                role: visitor ? 'not signed in' : staffRoles(pickle)[forced[1]] ?? '',
                command: forced[2],
                reason: /refused with reason "([^"]+)"/.exec(all)?.[1] ?? '',
                res: {},
            };
            entry.res[surface.id] = status;
            forcedByKey.set(key, entry);
        }
    }
}
const FOLDER_ORDER = { 'domain-rules': 0, workflows: 1, 'ui-only': 2 };
const rows = [...rowsByKey.values()].sort((a, b) => FOLDER_ORDER[a.folder] - FOLDER_ORDER[b.folder] || a.feature.localeCompare(b.feature));
const forced = [...forcedByKey.values()];

// --- The real parity gate, then the same gate on a tampered copy -------------------------------

function gate(dir) {
    const r = spawnSync(process.execPath, [join(root, 'tools/check-parity.mjs')], {
        cwd: root,
        encoding: 'utf8',
        env: dir ? { ...process.env, PARITY_REPORTS_DIR: dir } : process.env,
    });
    return { status: r.status, output: `${r.stdout}${r.stderr}` };
}

const verdict = gate();
const parity = verdict.status === 0 ? 'PASS' : 'FAIL';

let negative = null;
if (SURFACES.every((s) => existsSync(join(reports, `${s.id}.ndjson`)))) {
    const target = SURFACES.at(-1);
    const copy = mkdtempSync(join(tmpdir(), 'parity-negative-'));
    for (const s of SURFACES) copyFileSync(join(reports, `${s.id}.ndjson`), join(copy, `${s.id}.ndjson`));
    // Plant a change in one step of the first domain-rules scenario in the target surface's report.
    const lines = readFileSync(join(copy, `${target.id}.ndjson`), 'utf8').split('\n');
    let planted;
    for (let i = 0; i < lines.length && !planted; i++) {
        if (!lines[i].startsWith('{"pickle"')) continue;
        const m = JSON.parse(lines[i]);
        if (!m.pickle.uri.includes('features-shared/domain-rules/')) continue;
        const shown = withKeywords(m.pickle.steps);
        const index = m.pickle.steps.length - 1;
        const before = shown[index];
        m.pickle.steps[index].text = `${m.pickle.steps[index].text} (tampered)`;
        planted = { scenario: m.pickle.name, before, after: `${before} (tampered)` };
        lines[i] = JSON.stringify(m);
    }
    writeFileSync(join(copy, `${target.id}.ndjson`), lines.join('\n'));
    const tampered = gate(copy);
    rmSync(copy, { recursive: true, force: true });
    if (!planted) fail('negative check: no domain-rules scenario to tamper with');
    if (tampered.status === 0 || !tampered.output.includes('DIFFERS')) {
        fail(`negative check: the parity gate did not catch a planted step-text change (exit ${tampered.status})`);
    }
    const shown = (output) => output.trimEnd().split('\n').map((l) => {
        const text = l.replace(/\{"dataTable".*\}\}/, '[data table]').replace(/\{"docString".*\}\}/, '[doc string]');
        return [/DIFFERS|PARITY FAIL|but not on|\(tampered\)/.test(text) ? 'bad' : /PARITY PASS/.test(text) ? 'ok' : '', text];
    });
    negative = {
        surfaceLabel: target.label,
        ...planted,
        exitTampered: tampered.status,
        exitClean: verdict.status,
        lines: [
            ['', '$ npm run check:parity   # on a copy with one planted change'],
            ...shown(tampered.output),
            ['bad', `exit ${tampered.status}`],
            ['', ''],
            ['', '$ npm run check:parity   # on this run\'s real reports'],
            ...shown(verdict.output).filter(([, t]) => /PARITY|FAIL|^- /.test(t)),
            [verdict.status === 0 ? 'ok' : 'bad', `exit ${verdict.status}`],
        ],
    };
    console.log(`build-reports: negative check caught the planted change (exit ${tampered.status})`);
}

// --- Code shown in "Same step, four surfaces", read from the harness source --------------------

const abilities = join(harness, 'src/screenplay/abilities');
function sourceLine(file, pattern) {
    const line = readFileSync(join(abilities, file), 'utf8').split('\n').find((l) => pattern.test(l));
    if (!line) fail(`could not find ${pattern} in ${file}`);
    return line.trim();
}
function sourceBlock(file, pattern) {
    const lines = readFileSync(join(abilities, file), 'utf8').split('\n');
    const start = lines.findIndex((l) => pattern.test(l));
    if (start < 0) fail(`could not find ${pattern} in ${file}`);
    let depth = 0;
    for (let i = start; i < lines.length; i++) {
        depth += (lines[i].match(/\{/g) ?? []).length - (lines[i].match(/\}/g) ?? []).length;
        if (depth === 0 && i > start) {
            const block = lines.slice(start, i + 1);
            const indent = Math.min(...block.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
            return block.map((l) => l.slice(indent)).join('\n');
        }
    }
    fail(`unbalanced block for ${pattern} in ${file}`);
}
const clickAction = sourceBlock('BrowseTheWorkbench.ts', /private async clickAction\(/);
const browserApprove = sourceLine('BrowseTheWorkbench.ts', /^\s*approve = \(user/);
const impl = {
    core: { where: 'CallDomainCore.ts', code: `${sourceLine('CallDomainCore.ts', /^\s*approve = this\.call/)}\n\n${sourceBlock('CallDomainCore.ts', /private call</)}` },
    api: { where: 'CallLoanApi.ts', code: sourceLine('CallLoanApi.ts', /^\s*approve = \(user/) },
    angular: { where: "BrowseTheWorkbench.ts · rendering: 'client'", code: `${browserApprove}\n\n${clickAction}` },
    nextjs: { where: "BrowseTheWorkbench.ts · rendering: 'server'", code: `${browserApprove}\n\n${clickAction}` },
};

// --- Committed Phase 4 stability evidence ------------------------------------------------------

const evidence = JSON.parse(readFileSync(join(root, 'docs/evidence/2026-09-28_phase-4-stability-runs.json'), 'utf8'));
const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
};
const medians = Object.fromEntries(SURFACES.map((s) => [s.id, evidence.timingsColumns.map((_, c) => {
    const values = evidence.runs.map((r) => r.timings[s.id][c]);
    return values.includes(null) ? null : median(values);
})]));

// --- Write the page ----------------------------------------------------------------------------

const when = new Date();
const data = {
    meta: {
        parity,
        sha: process.env.GITHUB_SHA ?? null,
        repo: process.env.GITHUB_REPOSITORY ?? 'GBrooks1970/loan-origination-parity',
        runId: process.env.GITHUB_RUN_ID ?? null,
        generated: `${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}, ${when.toISOString().slice(11, 16)} UTC`,
    },
    reports: built,
    rows,
    titles,
    forced,
    runTimings,
    medians,
    runs: evidence.runs.map(({ run, id, wallS, parity: p, attempt }) => ({ run, id, wallS, parity: p, attempt })),
    evidenceCommit: evidence.commit,
    impl,
    negative,
};
const pageDir = join(root, 'tools/evidence-page');
const script = readFileSync(join(pageDir, 'page.js'), 'utf8');
const inline = (s) => s.replace(/<\/(script)/gi, '<\\/$1');
const html = readFileSync(join(pageDir, 'template.html'), 'utf8')
    .replace('/*__DATA__*/null', () => inline(JSON.stringify(data)))
    .replace('/*__SCRIPT__*/', () => inline(script));
writeFileSync(join(site, 'index.html'), html);
writeFileSync(join(site, '.nojekyll'), '');

const tally = SURFACES.filter((s) => runTimings[s.id]).map((s) => {
    const run = rows.filter((r) => r.res[s.id]);
    return `${s.id} ${run.filter((r) => r.res[s.id] === 'PASSED').length} of ${run.length} passed`;
});
console.log(`build-reports: wrote ${site} (parity ${parity}; ${tally.join('; ')}; ${forced.length} forced-command scenarios)`);
