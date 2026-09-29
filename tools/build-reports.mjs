#!/usr/bin/env node
// Builds the published evidence site: one Serenity BDD HTML report per surface, from the Serenity/JS
// JSON the harness wrote to test-harnesses/harness-serenity/target/site/serenity/<surface>/, plus an
// index page. Pass counts on the index come from the same run's Cucumber message streams in
// reports/<surface>.ndjson; nothing on the page is typed in by hand.
//
// Needs Java 17+. The Serenity BDD CLI jar ships inside @serenity-js/serenity-bdd, so `npm ci` provides it.
// Output: test-harnesses/harness-serenity/target/site/report/
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const harness = join(root, 'test-harnesses/harness-serenity');
const json = join(harness, 'target/site/serenity');
const reports = join(harness, 'reports');
const site = join(harness, 'target/site/report');
const cacheDir = 'node_modules/@serenity-js/serenity-bdd/cache';

const SURFACES = [
    { id: 'core', label: 'Core', what: 'the domain engine called in-process' },
    { id: 'api', label: 'API', what: 'the Node.js REST service over HTTP' },
    { id: 'angular', label: 'Angular', what: 'the Angular SPA in Chromium' },
    { id: 'nextjs', label: 'Next.js', what: 'the Next.js backend-for-frontend in Chromium' },
];

/** Passed and total scenarios, from the worst step status of each test case. */
function outcomes(surface) {
    const file = join(reports, `${surface}.ndjson`);
    if (!existsSync(file)) return undefined;
    const worst = new Map();
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const m = JSON.parse(line);
        if (m.testCaseStarted) worst.set(m.testCaseStarted.id, 'PASSED');
        if (m.testStepFinished && m.testStepFinished.testStepResult.status !== 'PASSED') {
            worst.set(m.testStepFinished.testCaseStartedId, m.testStepFinished.testStepResult.status);
        }
    }
    const statuses = [...worst.values()];
    return { passed: statuses.filter((s) => s === 'PASSED').length, total: statuses.length };
}

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

const rows = [];
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
    if (result.status !== 0 || !existsSync(join(site, surface.id, 'index.html'))) {
        console.error(`build-reports: Serenity BDD CLI failed for ${surface.id}`);
        process.exit(1);
    }
    rows.push({ ...surface, ...(outcomes(surface.id) ?? { passed: null, total: null }) });
}

if (rows.length === 0) {
    console.error('build-reports: no surface had Serenity/JS JSON; run a surface suite first');
    process.exit(1);
}

const sha = process.env.GITHUB_SHA;
const repo = process.env.GITHUB_REPOSITORY ?? 'GBrooks1970/loan-origination-parity';
const runUrl = process.env.GITHUB_RUN_ID ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;
const generated = new Date().toISOString().replace(/\.\d+Z$/, ' UTC').replace('T', ' ');
const count = (r) => (r.total === null ? 'not recorded' : `${r.passed} of ${r.total} passed`);

const page = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Loan Origination Parity: test reports</title>
<style>
  :root { color-scheme: light dark; --fg: #1d1d1f; --bg: #fdfdfc; --muted: #5f6368; --line: #d9d9d6; --accent: #0b5cad; }
  @media (prefers-color-scheme: dark) { :root { --fg: #ececec; --bg: #161617; --muted: #a0a4a8; --line: #3a3a3c; --accent: #7ab3f0; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 system-ui, sans-serif; }
  main { max-width: 52rem; margin: 0 auto; padding: 2.5rem 1rem 3rem; }
  h1 { font-size: 1.6rem; margin: 0 0 .5rem; }
  p { margin: .5rem 0 1rem; }
  .muted { color: var(--muted); font-size: .92rem; }
  table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; }
  th, td { text-align: left; padding: .6rem .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-size: .85rem; color: var(--muted); font-weight: 600; }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <h1>Loan Origination Parity: test reports</h1>
  <p>One Gherkin store and one Serenity/JS Screenplay harness run against four surfaces of the same UK loan-origination engine. Each report below is the Serenity BDD living documentation for one surface, from the same CI run. The CI parity gate compares, folder by folder, which scenarios passed on each surface and with what step text.</p>
  <table>
    <thead><tr><th>Surface</th><th>What the harness drives</th><th>Scenarios</th></tr></thead>
    <tbody>
${rows.map((r) => `      <tr><td><a href="${r.id}/index.html">${escape(r.label)}</a></td><td>${escape(r.what)}</td><td>${escape(count(r))}</td></tr>`).join('\n')}
    </tbody>
  </table>
  <p class="muted">Generated ${escape(generated)}${sha ? ` from commit <a href="https://github.com/${repo}/commit/${sha}"><code>${sha.slice(0, 7)}</code></a>` : ''}${runUrl ? ` by <a href="${runUrl}">CI run ${escape(process.env.GITHUB_RUN_ID)}</a>` : ' locally'}. Source: <a href="https://github.com/${repo}">${escape(repo)}</a>.</p>
</main>
</body>
</html>
`;
writeFileSync(join(site, 'index.html'), page);
writeFileSync(join(site, '.nojekyll'), '');
console.log(`build-reports: wrote ${site} (${rows.map((r) => `${r.id} ${count(r)}`).join('; ')})`);
