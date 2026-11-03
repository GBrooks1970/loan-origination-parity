# Walkthrough: Risk #3 — Portable Parity and Report Tooling on Windows

**Date:** 3 November 2026
**Owner decisions (3 November 2026):** Approved [`DOCS/implementation-plans/2026-11-03_risk-3-windows-report-tooling.md`](../../DOCS/implementation-plans/2026-11-03_risk-3-windows-report-tooling.md) (shared URI helper, `fileURLToPath`, shell-free local Serenity BDD CLI resolution, `npm run test:tools` wired into `npm run test:unit`, native Windows acceptance + existing Linux CI jobs, and draft PR publication).
**Base commit:** `34f73bad76b7a6622cc72d26cb1f3a1c789f2fce` (`main`)

---

## 1. What Was Done

1. **Shared URI, Negative-Check, and CLI Resolution Helper (`tools/report-paths.mjs`):**
   - `featureRelativePath(uri)` normalises backslashes (`\` → `/`), locates the `features-shared/` segment boundary, validates `<folder>/<name>.feature` structure, preserves filename case and spaces, and throws a descriptive `Error` on missing, empty, or malformed URIs.
   - `featureFolderAndFile(uri)` returns `{ path, folder, file, feature }` and `isFeatureInFolder(uri, targetFolder)` performs an exact first-folder match (`folder === targetFolder`).
   - `tamperFirstFolderPickleInNdjson(ndjsonText, targetFolder)` selects and tampers the final step of the first `domain-rules` pickle in an NDJSON stream regardless of whether Cucumber recorded backslash or forward-slash URIs.
   - `resolveSerenityBddCliPath(fromUrl)` uses `createRequire` to resolve `@serenity-js/serenity-bdd`'s `package.json` and declared `bin['serenity-bdd']` (`bin/serenity-bdd`), asserting the file exists on disk.
   - `assertSafeSubpath(parentDir, targetDir)` verifies computed report or temporary directories reside beneath their expected parent root before recursive `rmSync`.

2. **Updated Parity Gate, Timings Reporter, and HTML Report Builder:**
   - [`tools/check-parity.mjs`](../../tools/check-parity.mjs): replaced `new URL('..', import.meta.url).pathname` with `fileURLToPath(new URL('..', import.meta.url))` and replaced `.split('features-shared/')` on lines 55 and 70 with `featureFolderAndFile` and `featureRelativePath`.
   - [`tools/report-timings.mjs`](../../tools/report-timings.mjs): replaced `new URL('../test-harnesses/harness-serenity/reports/', import.meta.url).pathname` with `fileURLToPath(new URL('../test-harnesses/harness-serenity/reports/', import.meta.url))`.
   - [`tools/build-reports.mjs`](../../tools/build-reports.mjs): replaced `new URL('..', import.meta.url).pathname` with `fileURLToPath`, replaced `spawnSync('npx', ['serenity-bdd', 'run', ...])` with `spawnSync(process.execPath, [serenityBddCliPath, 'run', ...])`, replaced raw `pickle.uri` splits and `.includes('features-shared/domain-rules/')` with `featureFolderAndFile` and `tamperFirstFolderPickleInNdjson`, and guarded recursive `rmSync` calls with `assertSafeSubpath`.

3. **Added Unit and Integration Tests (`tools/tests/report-tooling.test.mjs`):**
   - Added 11 tests across 5 suites (`npm run test:tools`) and wired `&& npm run test:tools` into `npm run test:unit` in [`package.json`](../../package.json) so the existing Linux CI static job executes them automatically.

4. **Documentation and Backlog Reconciliation:**
   - Updated [`docs/backlog.md`](../backlog.md) to version 8, moving `Risk #3` to `### Resolved Risks` (`0` outstanding risks remaining).
   - Recorded implementation details in [`DOCS/implementation-logs/2026-11-03_risk-3-windows-report-tooling.md`](../../DOCS/implementation-logs/2026-11-03_risk-3-windows-report-tooling.md) and updated [`README.md`](../../README.md) and [`CHANGELOG.md`](../../CHANGELOG.md).

---

## 2. Empirical Verification Evidence (Windows 11, Node `v24.18.0`, Temurin `25.0.4.1`)

### 2.1 Static Checks and Unit / Tooling Tests

- `npm run typecheck` — **PASS** (`@lop/domain-core`, `@lop/demoapp001-node-service`, `@lop/demoapp002-angular-spa`, `@lop/demoapp003-nextjs-bff`, `@lop/harness-serenity`).
- `npm run test:unit` — **PASS**:
  - `@lop/domain-core`: `23/23` passed (`1,135.81 ms`)
  - `@lop/demoapp001-node-service`: `4/4` passed (`4,978.82 ms`)
  - `npm run test:tools` (`tools/tests/report-tooling.test.mjs`): `11/11` passed (`2,754.63 ms`)

```text
▶ report-paths.mjs — URL conversion & safe subpath guards (11.18ms)
▶ report-paths.mjs — portable Cucumber feature URI contract (6.56ms)
▶ report-paths.mjs — negative-check tamper selection on NDJSON streams (3.64ms)
▶ Consumer integration — check-parity.mjs with clean, tampered, and missing reports (910.64ms)
▶ CLI launch contract — shell-free @serenity-js/serenity-bdd resolution (1507.12ms)
ℹ tests 11 | suites 5 | pass 11 | fail 0 | duration_ms 2754.6338
```

### 2.2 Fresh Four-Surface Runs on Windows

All four surfaces were executed natively on Windows (`PORT=8010` / `API_PORT=8010` used for the test-mode Node service because local port `8000` was occupied by another workstation process):

| Surface | Command | Scenarios | Suite Time | Wall Time | Set-up p50 / p95 / max | Status |
|---|---|---:|---:|---:|---:|---|
| Core | `npm run test:core` | `33 / 33` | `7.4 s` | `7.56 s` | — | ✅ PASS |
| API | `npm run test:api` | `85 / 85` | `26.1 s` | `26.40 s` | `28.43 / 49.84 / 111.80 ms` | ✅ PASS |
| Angular | `npm run test:angular` | `106 / 106` | `143.4 s` | `143.80 s` | `27.41 / 44.97 / 118.48 ms` | ✅ PASS |
| Next.js | `npm run test:nextjs` | `106 / 106` | `171.1 s` | `171.76 s` | `26.11 / 45.81 / 109.68 ms` | ✅ PASS |

### 2.3 Parity Gate (`npm run check:parity`) and Measured Timings (`npm run report:timings`)

```text
domain-rules   core     33 passed /  33 run / 33 in Gherkin · step text identical to core
domain-rules   api      33 passed /  33 run / 33 in Gherkin · step text identical to core
domain-rules   angular  33 passed /  33 run / 33 in Gherkin · step text identical to core
domain-rules   nextjs   33 passed /  33 run / 33 in Gherkin · step text identical to core
workflows      api      52 passed /  52 run / 52 in Gherkin · step text identical to api
workflows      angular  52 passed /  52 run / 52 in Gherkin · step text identical to api
workflows      nextjs   52 passed /  52 run / 52 in Gherkin · step text identical to api
ui-only        angular  21 passed /  21 run / 21 in Gherkin · step text identical to angular
ui-only        nextjs   21 passed /  21 run / 21 in Gherkin · step text identical to angular

PARITY PASS — every targeted surface passes the same scenarios, with identical step text, in each of its folders; no step definition branches on surface.
```

| Surface | Scenarios | Suite | Scenario p50 | Scenario p95 | Scenario max | Set-up p50 | Set-up p95 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| core | 33 | 7.4 s | 155 ms | 248 ms | 277 ms | — | — |
| api | 85 | 26.1 s | 298 ms | 390 ms | 418 ms | 28.43 ms | 49.84 ms |
| angular | 106 | 143.4 s | 1177 ms | 2058 ms | 4948 ms | 27.41 ms | 44.97 ms |
| nextjs | 106 | 171.1 s | 1430 ms | 2421 ms | 3306 ms | 26.11 ms | 45.81 ms |

### 2.4 Serenity BDD HTML Report Generation and Negative Check (`npm run report:html`)

Using local OpenJDK Temurin `25.0.4.1`, `npm run report:html` generated all four Serenity BDD HTML reports plus the evidence index page and verified the planted-change negative check:

```text
build-reports: negative check caught the planted change (exit 1)
build-reports: wrote D:\_CLAUDE_COWORK\PROJ001\claude-outputs\test-automation-portfolio\loan-origination-parity\test-harnesses\harness-serenity\target\site\report (parity PASS; core 33 of 33 passed; api 85 of 85 passed; angular 106 of 106 passed; nextjs 106 of 106 passed; 19 forced-command scenarios)
```

Inspection of `test-harnesses/harness-serenity/target/site/report/` confirmed:
- `core/index.html` (`121,329` bytes), `api/index.html` (`247,748` bytes), `angular/index.html` (`289,835` bytes), `nextjs/index.html` (`289,833` bytes)
- `index.html` (`105,171` bytes): `33` `domain-rules` rows, `52` `workflows` rows, `21` `ui-only` rows, `exitClean: 0`, and `exitTampered: 1`.

### 2.5 Note on Local Windows Python Oracle Environment

On this Windows workstation, `python3` resolves to the disabled Microsoft Store App Execution Alias (`python` invokes Python `3.13.1`), and the global Python `3.13.1` installation does not have the optional `tzdata` wheel installed (`ZoneInfoNotFoundError: 'No time zone found with key Europe/London'`). In accordance with the managing-python-dependencies rule (no global `pip install`) and the approved plan's verification rules, this workstation-specific Python condition was recorded without mutating global Python packages, and `README.md` was updated to document `pip install gherkin-official==42.0.1 tzdata` for Windows contributors. The oracle check (`npm run check:oracle`) runs in full on the Linux CI `static` job.
