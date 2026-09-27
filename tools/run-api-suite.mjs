#!/usr/bin/env node
// Builds and starts the Node service in test mode, waits for /health, runs the harness
// against the API surface, then stops the service. Exit code is the harness's.
import { spawn } from 'node:child_process';

const port = process.env.PORT ?? '8000';
const token = process.env.TEST_CONTROL_TOKEN ?? 'local-test-token';
const baseUrl = `http://127.0.0.1:${port}`;

const run = (command, args, options = {}) =>
    new Promise((resolve) => {
        const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });
        child.on('exit', (code) => resolve(code ?? 1));
    });

for (const workspace of ['@lop/domain-core', '@lop/demoapp001-node-service']) {
    const code = await run('npm', ['run', 'build', '-w', workspace]);
    if (code !== 0) process.exit(code);
}

const service = spawn('node', ['demo-apps/demoapp001-node-service/dist/server.js'], {
    stdio: 'inherit',
    env: { ...process.env, APP_MODE: 'test', TEST_CONTROL_TOKEN: token, PORT: port },
});

const deadline = Date.now() + 30_000;
for (;;) {
    try {
        const res = await fetch(`${baseUrl}/health`);
        if (res.ok && (await res.json()).testMode === true) break;
    } catch {
        // not listening yet
    }
    if (Date.now() > deadline) {
        service.kill();
        console.error(`Node service did not become healthy at ${baseUrl}`);
        process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 200));
}

const code = await run('npm', ['run', 'test:api', '-w', '@lop/harness-serenity'], {
    env: { ...process.env, LOP_API_URL: baseUrl, TEST_CONTROL_TOKEN: token },
});
service.kill('SIGTERM');
process.exit(code);
