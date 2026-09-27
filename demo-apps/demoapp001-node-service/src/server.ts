import { createApp } from './app.js';
import { configFromEnvironment } from './config.js';

const config = configFromEnvironment();
const server = createApp(config).listen(config.port, () => {
    console.log(`demoapp001-node-service listening on :${config.port}${config.testMode ? ' (test mode)' : ''}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
