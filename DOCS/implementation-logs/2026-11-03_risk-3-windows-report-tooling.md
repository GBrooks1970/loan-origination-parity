<!--
  AUDIENCE: Engineers and AI agents reviewing development session history.
  PURPOSE:  Record what was built, what was decided, what broke, and what was learned
            during a development session. Immutable once written — append only.
  LOCATION: DOCS/implementation-logs/YYYY-MM-DD_[topic].md
  TEMPLATE: DOCS/templates/implementation-log.template.md
-->

# Risk #3: Portable Parity and Report Tooling on Windows — 2026-11-03

## Session Summary

Resolved backlog `Risk #3` (`Score 5: Security 0 + Breakage 3 + Maintenance 2`) by making `tools/check-parity.mjs`, `tools/build-reports.mjs`, and `tools/report-timings.mjs` run natively on Windows while preserving exact Linux scenario identity, folder grouping, and negative-check tamper detection. Created [`tools/report-paths.mjs`](../../tools/report-paths.mjs) to centralise Cucumber feature URI normalisation, exact first-folder matching, negative-check `domain-rules` tamper selection, safe directory deletion checks, and shell-free `@serenity-js/serenity-bdd` CLI resolution (`bin/serenity-bdd`). Added 11 unit and integration tests in [`tools/tests/report-tooling.test.mjs`](../../tools/tests/report-tooling.test.mjs) (`npm run test:tools`, wired into `npm run test:unit`), and verified all four application surfaces, the parity gate, the timings reporter, and the Serenity BDD HTML report builder on Windows (Node `v24.18.0`, Temurin `25.0.4.1`).

---

## Objectives

1. ✅ Replace `new URL(..., import.meta.url).pathname` with `fileURLToPath` across `tools/check-parity.mjs`, `tools/build-reports.mjs`, and `tools/report-timings.mjs` so Windows drive paths are not doubled (`D:\D:\...`) and spaces/percent-encoded characters are decoded properly.
2. ✅ Centralise Cucumber `pickle.uri` normalisation in `tools/report-paths.mjs` (`featureRelativePath`, `featureFolderAndFile`, `isFeatureInFolder`, `tamperFirstFolderPickleInNdjson`) so Windows backslash URIs (`..\\..\\features-shared\\domain-rules\\...`) and POSIX forward-slash URIs produce identical scenario keys, folder classifications, and negative-check tamper targets.
3. ✅ Replace shell-dependent `spawnSync('npx', ['serenity-bdd', 'run', ...])` in `tools/build-reports.mjs` with `process.execPath` and the locally resolved `@serenity-js/serenity-bdd` CLI script (`resolveSerenityBddCliPath`), preserving argument boundaries and surfacing launch errors clearly.
4. ✅ Add unit and integration tests in `tools/tests/report-tooling.test.mjs` (`npm run test:tools`, wired into `npm run test:unit`) covering URI normalisation, must-fail legacy split/includes regression proof, negative parity detection on tampered `domain-rules` steps, safe subpath guards, and shell-free CLI execution.
5. ✅ Execute the Windows verification matrix across fresh four-surface runs (`core`, `api`, `angular`, `nextjs`), `check:parity`, `report:timings`, and `report:html`, and reconcile `docs/backlog.md` (v8), `README.md`, and `CHANGELOG.md`.

---

## Test Results

| Stack | Suite | Before | After | Status |
|---|---|---|---|---|
| Node.js (`@lop/domain-core`) | `npm run test:unit -w @lop/domain-core` | 23/23 | 23/23 (1.14 s) | ✅ PASS |
| Node.js (`@lop/demoapp001-node-service`) | `npm run test:unit -w @lop/demoapp001-node-service` | 4/4 | 4/4 (4.98 s) | ✅ PASS |
| Node.js (`tools/tests/report-tooling.test.mjs`) | `npm run test:tools` | 0/0 (not present) | 11/11 (2.75 s) | ✅ PASS |
| Serenity/JS (`core` surface) | `npm run test:core` | 33/33 | 33/33 (7.4 s suite / 7.56 s wall) | ✅ PASS |
| Serenity/JS (`api` surface) | `npm run test:api` (`PORT=8010`) | 85/85 | 85/85 (26.1 s suite / 26.40 s wall) | ✅ PASS |
| Serenity/JS (`angular` surface) | `npm run test:angular` (`API_PORT=8010`) | 106/106 | 106/106 (143.4 s suite / 143.80 s wall) | ✅ PASS |
| Serenity/JS (`nextjs` surface) | `npm run test:nextjs` (`API_PORT=8010`) | 106/106 | 106/106 (171.1 s suite / 171.76 s wall) | ✅ PASS |
| Parity Gate (`tools/check-parity.mjs`) | `npm run check:parity` (Windows) | ❌ FAIL (`ENOENT: scandir 'D:\D:\...'` & `undefined.split`) | 33/33, 52/52, 21/21 (`PARITY PASS`) | ✅ PASS |
| Timings Reporter (`tools/report-timings.mjs`) | `npm run report:timings` (Windows) | ❌ FAIL (`ENOENT` on `/D:/...`) | 4/4 surfaces summarised | ✅ PASS |
| HTML Report Builder (`tools/build-reports.mjs`) | `npm run report:html` (Windows, Temurin 25.0.4.1) | ❌ FAIL (`ENOENT` on `npx` / silent 0 `domain-rules` tamper) | 4 surface HTML reports + `index.html` + negative check exit 1 | ✅ PASS |

---

## Changes Implemented

### 1. Shared Portable URI, Negative-Check, and CLI Resolution Helper

**Files changed:**
- `tools/report-paths.mjs` — created shared module exporting `featureRelativePath(uri)`, `featureFolderAndFile(uri)`, `isFeatureInFolder(uri, targetFolder)`, `tamperFirstFolderPickleInNdjson(ndjsonText, targetFolder)`, ` withKeywords(steps)`, `resolveSerenityBddCliPath(fromUrl)`, and `assertSafeSubpath(parentDir, targetDir)`.

### 2. Parity Gate, Timings Reporter, and HTML Report Builder Portability Fixes

**Files changed:**
- `tools/check-parity.mjs` — replaced `new URL('..', import.meta.url).pathname` with `fileURLToPath(new URL('..', import.meta.url))` and replaced raw `.split('features-shared/')` calls on lines 55 and 70 with `featureFolderAndFile` and `featureRelativePath`.
- `tools/report-timings.mjs` — replaced `new URL('../test-harnesses/harness-serenity/reports/', import.meta.url).pathname` with `fileURLToPath(new URL('../test-harnesses/harness-serenity/reports/', import.meta.url))`.
- `tools/build-reports.mjs` — replaced `new URL('..', import.meta.url).pathname` with `fileURLToPath`, resolved `@serenity-js/serenity-bdd`'s `bin/serenity-bdd` via `resolveSerenityBddCliPath()` and launched it with `spawnSync(process.execPath, [serenityBddCliPath, 'run', ...])`, replaced raw `pickle.uri.split('features-shared/')[1]` and `.includes('features-shared/domain-rules/')` with `featureFolderAndFile` and `tamperFirstFolderPickleInNdjson`, and guarded recursive `rmSync` calls with `assertSafeSubpath`.

### 3. Tooling Unit & Integration Test Suite

**Files changed:**
- `tools/tests/report-tooling.test.mjs` — added 11 tests across 5 suites verifying `fileURLToPath` space decoding, `assertSafeSubpath` boundary enforcement, Windows backslash and POSIX slash URI equivalence, invalid URI rejection, must-fail legacy split/includes regression proof, negative-check `domain-rules` tamper selection, real `check-parity.mjs` consumer execution on clean/tampered/missing report directories, and shell-free Serenity BDD CLI execution.
- `package.json` — added `"test:tools": "node --test tools/tests/report-tooling.test.mjs"` and wired `&& npm run test:tools` into `test:unit`.

---

## Technical Decisions

| Decision | Rationale | Alternatives rejected |
|---|---|---|
| Resolve `@serenity-js/serenity-bdd`'s `bin/serenity-bdd` via `createRequire` and execute with `process.execPath` | Avoids `npx` `ENOENT` on Windows without enabling `shell: true`, preventing shell-quoting hazards on `--project` titles or paths containing spaces and avoiding accidental network package fetches | `spawnSync('npx', ..., { shell: true })` (requires shell quoting and depends on `npx` wrapper resolution) |
| Enforce exact `<folder>/<file>.feature` structure beneath `features-shared/` in `featureRelativePath` | Ensures `isFeatureInFolder(uri, 'domain-rules')` matches only the first folder beneath `features-shared/` and fails loudly if an unexpected URI shape appears | Loose `.replaceAll('\\', '/').includes('features-shared/domain-rules/')` scattered across callers |
| Guard `rmSync` targets with `assertSafeSubpath` | Prevents accidental recursive deletion outside `target/site` or `os.tmpdir()` if paths are ever refactored | Unchecked `rmSync(..., { recursive: true, force: true })` |

---

## Documentation Updates

- `DOCS/implementation-plans/2026-11-03_risk-3-windows-report-tooling.md` — recorded owner approval and final delivery outcome.
- `DOCS/implementation-plans/_index.md` — updated `Risk #3` status to delivered.
- `DOCS/implementation-logs/2026-11-03_risk-3-windows-report-tooling.md` — authored this immutable implementation log.
- `docs/walkthroughs/2026-11-03_risk-3-windows-report-tooling.md` — authored versioned repository walkthrough with empirical verification output.
- `docs/backlog.md` — bumped to version 8, moved `Risk #3` to `### Resolved Risks`, and updated `Risk Summary` to 0 outstanding risks.
- `README.md` — noted `tzdata` and `python` alias guidance for Windows oracle execution and `npm run test:tools` in `verify`.
- `CHANGELOG.md` — recorded `tools/report-paths.mjs`, `tools/tests/report-tooling.test.mjs`, and the `Risk #3` fixes under `[Unreleased]`.

---

## Lessons Learned

- Quiet substring checks on raw Cucumber `pickle.uri` fields (`!m.pickle.uri.includes('features-shared/domain-rules/')`) are especially hazardous across platforms because Cucumber records OS-native path separators in `pickle.uri` (`\` on Windows, `/` on Linux). Centralising URI parsing into a strict helper that validates structure and normalises separators once eliminates silent misses.
- On Windows workstations where `python3` resolves to the disabled Microsoft Store App Execution Alias and system Python 3.13 does not bundle IANA timezone data by default, `ZoneInfo("Europe/London")` requires the `tzdata` package and invocation via `python` (whereas Ubuntu CI runners provide system `tzdata` and `python3` out of the box).
- When running `npm run test:api`, `npm run test:angular`, or `npm run test:nextjs` on a developer machine where port `8000` is occupied by another local process, setting `PORT=8010` / `API_PORT=8010` cleanly isolates the test-mode Node service without modifying any repository configuration.

---

## Recommendations / Next Steps

- [ ] Review and merge the `codex/loan-risk-3-windows-tooling` draft PR in `loan-origination-parity` and the companion v2 session handover draft PR in `test-automation-portfolio` — Owner (`Gary`).
- [ ] Optional future candidate (not requested): add a non-blocking or scheduled `windows-latest` job in `.github/workflows/ci.yml` if automated Windows CI regression coverage is desired beyond `npm run test:tools` running in the Linux static job.

---

*Session logged: 2026-11-03. Author: Antigravity (on behalf of Gary Brooks).*
