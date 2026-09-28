import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Test builds only (DR-005): copies the harness's `test-namespace` cookie into the
 * X-Test-Namespace header so each scenario talks to its own isolated engine.
 * In production builds LOP_TEST_MODE is false and this is a no-op.
 */
export const testNamespaceInterceptor: HttpInterceptorFn = (req, next) => {
    if (!LOP_TEST_MODE) return next(req);
    const match = /(?:^|;\s*)test-namespace=([^;]+)/.exec(document.cookie);
    return match ? next(req.clone({ setHeaders: { 'X-Test-Namespace': decodeURIComponent(match[1]!) } })) : next(req);
};
