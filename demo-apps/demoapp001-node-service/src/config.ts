export interface ServiceConfig {
    port: number;
    /** APP_MODE=test enables namespaces, the virtual clock, test-control routes and fixture sign-in (DR-005, DR-012). */
    testMode: boolean;
    testControlToken: string | undefined;
    sessionSecret: string;
}

export function configFromEnvironment(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
    const testMode = env.APP_MODE === 'test';
    const testControlToken = env.TEST_CONTROL_TOKEN;
    if (testMode && !testControlToken) {
        throw new Error('APP_MODE=test requires TEST_CONTROL_TOKEN');
    }
    return {
        port: Number(env.PORT ?? 8000),
        testMode,
        testControlToken,
        sessionSecret: env.SESSION_SECRET ?? cryptoRandom(),
    };
}

function cryptoRandom(): string {
    return globalThis.crypto.randomUUID() + globalThis.crypto.randomUUID();
}
