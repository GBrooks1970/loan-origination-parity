#!/usr/bin/env node
// Builds domain-core, the Node service and a UI (test configuration), starts the service in test mode
// and the UI's same-origin server, runs the harness against that UI surface, then stops both.
// Usage: node tools/run-ui-suite.mjs angular [-- <cucumber arguments>]
import { spawn } from 'node:child_process';

const surface = process.argv[2] ?? 'angular';
const UIS = {
    angular: { workspace: '@lop/demoapp002-angular-spa', build: 'build:test', server: 'demo-apps/demoapp002-angular-spa/server.mjs' },
};
const ui = UIS[surface];
if (!ui) {
    console.error(`Unknown UI surface ${surface}`);
    process.exit(2);
}

const apiPort = process.env.API_PORT ?? '8000';
const uiPort = process.env.UI_PORT ?? '4200';
const token = process.env.TEST_CONTROL_TOKEN ?? 'local-test-token';
const apiUrl = `http://127.0.0.1:${apiPort}`;
const uiUrl = `http://127.0.0.1:${uiPort}`;

const run = (command, args, options = {}) =>
    new Promise((resolve) => {
        const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });
        child.on('exit', (code) => resolve(code ?? 1));
    });

async function healthy(url, check) {
    const deadline = Date.now() + 30_000;
    for (;;) {
        try {
            const res = await fetch(url);
            if (res.ok && (await check(res))) return;
        } catch {
            // not listening yet
        }
        if (Date.now() > deadline) throw new Error(`${url} did not become healthy`);
        await new Promise((r) => setTimeout(r, 200));
    }
}

for (const [workspace, script] of [
    ['@lop/domain-core', 'build'],
    ['@lop/demoapp001-node-service', 'build'],
    [ui.workspace, ui.build],
]) {
    const code = await run('npm', ['run', script, '-w', workspace]);
    if (code !== 0) process.exit(code);
}

const children = [
    spawn('node', ['demo-apps/demoapp001-node-service/dist/server.js'], {
        stdio: 'inherit',
        env: { ...process.env, APP_MODE: 'test', TEST_CONTROL_TOKEN: token, PORT: apiPort },
    }),
    spawn('node', [ui.server], { stdio: 'inherit', env: { ...process.env, LOP_API_URL: apiUrl, PORT: uiPort } }),
];
const stop = () => children.forEach((c) => c.kill('SIGTERM'));

try {
    await healthy(`${apiUrl}/health`, async (res) => (await res.json()).testMode === true);
    await healthy(`${uiUrl}/`, async (res) => (await res.text()).includes('<lop-root'));
} catch (error) {
    console.error(String(error));
    stop();
    process.exit(1);
}

// Anything after `--` is passed to Cucumber, e.g. `-- --name "Debt service ratio"`.
const passThrough = process.argv.includes('--') ? process.argv.slice(process.argv.indexOf('--') + 1) : [];
const code = await run('npm', ['run', `test:${surface}`, '-w', '@lop/harness-serenity', ...(passThrough.length ? ['--', ...passThrough] : [])], {
    env: { ...process.env, LOP_API_URL: apiUrl, LOP_UI_URL: uiUrl, TEST_CONTROL_TOKEN: token },
});
stop();
process.exit(code);
