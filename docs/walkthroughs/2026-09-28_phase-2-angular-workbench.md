# Walkthrough: Phase 2 — Angular Underwriter Workbench

**Date:** 28 September 2026
**Branch:** `phase-2/angular-workbench` (base `main` @ `4820f31`)
**Owner decisions:** go-ahead for Phase 2; plain CSS for styling (27 September 2026)

## 1. What was done

- **Server-computed affordances (DR-015, `0989891`).** `domain-core` gains `availableActions()` and `staffActions()`, a dry run of the §7.2 checks that writes no audit record. They are exposed as `GET /api/v1/applications/{id}/actions` and `GET /api/v1/me/actions` (OpenAPI 1.3.0), so UIs render affordances instead of re-deriving rules.
- **`demo-apps/demoapp002-angular-spa`.** Angular 22.2: standalone components, signals, zoneless change detection, reactive forms, plain CSS.
  - The six pages from spec §10.2, with fixed accessible names and `data-value` carriers (DR-007).
  - A test-only build flag (`LOP_TEST_MODE` via `define`) gates the fixture sign-in page and the namespace interceptor.
  - Served same-origin by `server.mjs`, which proxies `/api` to the Node service (DR-014).
- **Harness browser surface (DR-016).**
  - `BrowserBackend` and `BrowseTheWorkbench` implement the existing abstract ability with Playwright: commands click the real controls, and questions read rendered `data-value` attributes.
  - Preconditions go through the API. Forced commands go to the API with the browser's own session cookie (DR-010).
  - `UseTheScreens` provides the UI-only steps: views, affordances, axe-core, formatting and console errors. Each member of staff gets a separate browser context (`en-GB`, `Europe/London`).
- **Runner and gate.** `tools/run-ui-suite.mjs` builds everything and starts both servers; arguments after `--` pass through to Cucumber. The parity gate now covers three surfaces and forbids step definitions from referencing browser-surface modules.
- **CI.** Installs Playwright Chromium and runs the Angular surface. The job timeout rose to 25 minutes.

## 2. Evidence

Clean `npm run verify` (after `npm ci` and deleting all build output), exit 0 in 135 s:

```
ℹ tests 23  ℹ pass 23  ℹ fail 0                 (domain-core)
ℹ tests 4   ℹ pass 4   ℹ fail 0                 (Node service contract)
Checked 99 expected values across 40 scenarios and the §13 fixtures.
Scenarios:  33   Total time: 3s 902ms            (core)
Scenarios:  85   Total time: 12s 742ms           (API)
Scenarios:  106  Total time: 1m 31s 807ms        (Angular)
Per-scenario set-up (api): p50 3.99 ms, p95 6.96 ms, max 47.19 ms over 85 scenarios
Per-scenario set-up (angular): p50 4.42 ms, p95 7.99 ms, max 39.55 ms over 106 scenarios
domain-rules   core     33 passed /  33 run / 33 in Gherkin
domain-rules   api      33 passed /  33 run / 33 in Gherkin
domain-rules   angular  33 passed /  33 run / 33 in Gherkin
workflows      api      52 passed /  52 run / 52 in Gherkin
workflows      angular  52 passed /  52 run / 52 in Gherkin
ui-only        angular  21 passed /  21 run / 21 in Gherkin
PARITY PASS
```

**Negative check.** I planted a UI bug: the ratio's `data-value` bound to the credit band. Five ratio scenarios failed (`Expected the debt service ratio to equal "25.00"` and so on) and the run exited 1. The file was then restored.

## 3. Defects found and fixed during the phase

1. **Decline never submitted.** The decline and sign-in forms used `(ngSubmit)` on a `<form>` without `[formGroup]`. With only `ReactiveFormsModule`, `ngSubmit` does not fire and the browser does a native submit. Two scenarios (Uma and Sam declining) timed out waiting for the POST. Fixed with `(submit)` and `preventDefault()`.
2. **Step definitions imported a surface module.** The new three-surface parity gate failed because `ui.steps.ts` imported `UseTheScreens` from the file containing the browser surface implementation. `UseTheScreens` now has its own module, and the gate passes.
3. **Local Node too old for Angular CLI 22.2** (requires `>=22.22.3`; the container had 22.22.2). I installed Node 24.21.0 into the scratch area after verifying its SHA-256 against nodejs.org's `SHASUMS256.txt`. The workspace `engines` minimum was raised to 22.22.3 and recorded in DR-009.
4. `server.mjs` was first written to `src/` by mistake. The runner reported it missing and it was moved.

## 4. Notes and limits

- Locally, Playwright 1.63 used the environment's Chromium 141 (`/opt/pw-browsers`, revision 1194) via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. CI installs Playwright's own matching Chromium, and the first CI run on the PR is the check of that combination.
- DR-016 trade-off: Serenity reports show task-level activities on the browser surface, not individual clicks.
- DR-014 – DR-016 are Proposed and need owner acceptance.
