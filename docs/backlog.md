# Loan Origination Parity — Backlog

**Version:** 8 — Risk #3 (Windows parity and report tooling) resolved with shared `tools/report-paths.mjs`, `fileURLToPath`, shell-free Serenity BDD CLI resolution, and 11 unit/integration tests (`npm run test:tools`); version 7 extended Risk #3 to cover `build-reports.mjs` and `report-timings.mjs`; version 6 added Risk #3; Risk #2 (Ubuntu 26 runner migration) resolved by a green trial run
**Last Updated:** 2026-11-03
**Based on:** [Phase 4 walkthrough](walkthroughs/2026-09-28_phase-4-parity-hardening.md) and the CI warnings on every run since Phase 1; version 2 records the resolution of Risk #1; version 4 adds Risk #2 from the runner notice on every CI job; version 5 records its resolution; version 8 records the resolution of Risk #3 ([Windows report tooling walkthrough](walkthroughs/2026-11-03_risk-3-windows-report-tooling.md))

This backlog tracks the open risks and candidate work left after all four roadmap phases, ordered by priority score (highest first). Only evidence-backed items are listed.

**Priority Scoring System:**
- **Score = Security Impact (0–10) + Breakage Probability (0–10) + Maintenance Burden (0–10)**
- **HIGH (20–30):** Critical — immediate action required
- **MEDIUM (10–19):** Important — schedule within current sprint cycle
- **LOW (0–9):** Desirable — schedule when capacity allows

---

## Outstanding Risks

Risks are ordered by priority score (highest first). Each risk includes a priority score breakdown.

**Status vocabulary.** `READY TO START`, `IN PROGRESS` and `BLOCKED` are stages of open work; `COMPLETE` is a delivery; `RECORDED` is an accepted risk, closed to work but not a delivery. A resolved risk belongs under `### Resolved Risks`.

### HIGH Priority (Score: 20–30)

None.

---

### MEDIUM Priority (Score: 10–19)

None.

---

### LOW Priority (Score: 0–9)

None.

---

### Resolved Risks

#### Risk #3: the parity gate and report scripts do not run on Windows ✅ Resolved 2026-11-03

**Resolution:** Added [`tools/report-paths.mjs`](../tools/report-paths.mjs) to centralise Cucumber `pickle.uri` normalisation (`featureRelativePath`, `featureFolderAndFile`, `isFeatureInFolder`), negative-check `domain-rules` tamper selection (`tamperFirstFolderPickleInNdjson`), safe directory deletion checks (`assertSafeSubpath`), and shell-free `@serenity-js/serenity-bdd` CLI resolution (`resolveSerenityBddCliPath`). Updated [`tools/check-parity.mjs`](../tools/check-parity.mjs), [`tools/build-reports.mjs`](../tools/build-reports.mjs), and [`tools/report-timings.mjs`](../tools/report-timings.mjs) to convert script URLs via `fileURLToPath`, use the shared URI helper for scenario grouping, identity, and negative-check tampering, and invoke `bin/serenity-bdd` via `process.execPath` with an argument array instead of `npx`. Added 11 unit and integration tests in [`tools/tests/report-tooling.test.mjs`](../tools/tests/report-tooling.test.mjs) (`npm run test:tools`, wired into `npm run test:unit`). Verified on Windows (Node 24.18.0, Temurin 25.0.4.1) across fresh four-surface runs (`core` 33/33 in 7.4 s, `api` 85/85 in 26.1 s, `angular` 106/106 in 143.4 s, `nextjs` 106/106 in 171.1 s), `npm run check:parity` (`PARITY PASS`: 33/33, 52/52, 21/21), `npm run report:timings`, and `npm run report:html` (all 4 Serenity BDD HTML reports + `index.html` generated, with the negative check catching the planted `domain-rules` change with exit 1), and on Linux CI. Actual effort was about 1 hour, against the 2-hour estimate.
**See:** [`DOCS/implementation-plans/2026-11-03_risk-3-windows-report-tooling.md`](../DOCS/implementation-plans/2026-11-03_risk-3-windows-report-tooling.md), [`DOCS/implementation-logs/2026-11-03_risk-3-windows-report-tooling.md`](../DOCS/implementation-logs/2026-11-03_risk-3-windows-report-tooling.md), and [`docs/walkthroughs/2026-11-03_risk-3-windows-report-tooling.md`](walkthroughs/2026-11-03_risk-3-windows-report-tooling.md).

#### Risk #2: CI runners move to Ubuntu 26 from 19 October 2026 ✅ Resolved 2026-09-30

**Resolution:** A trial run pinned all five jobs to `runs-on: ubuntu-26.04` (draft PR #16, commit `13a6425`, not merged). Run `36679303197` passed every job on image `ubuntu-26.04` version `20260920.143.1`, whose banner reads 'Ubuntu 26.04.1 LTS'. That covered Playwright's `--with-deps` Chromium install, the Python 3.12 and Temurin 21 tool caches, all four surfaces, PARITY PASS, and the report build with its negative check. No job carried any annotation. `ci.yml` keeps `ubuntu-latest`, so the move on 19 October 2026 needs no change. Actual effort was under 1 hour, against the 1–2 hour estimate.
**See:** PR #16 and run `36679303197`.

#### Risk #1: CI actions run on the deprecated Node 20 runtime ✅ Resolved 2026-09-29

**Resolution:** Moved every action in `.github/workflows/ci.yml` to its first Node 24 major: `checkout@v5`, `setup-node@v5`, `upload-artifact@v6` and `download-artifact@v7`. Each target's `action.yml` declares `using: node24`. `setup-python@v5` also ran on Node 20, although this risk did not list it, so it moved to `setup-python@v6`. Every input the workflow uses (`persist-credentials`, `node-version-file`, `cache`, `python-version`, `name`, `path`, `if-no-files-found`, `pattern`, `merge-multiple`) exists in the new majors. `package.json` has no `packageManager` field, so setup-node v5's automatic caching does not change behaviour. Actual effort was about 1 hour, matching the estimate.
**See:** commit 'ci: move GitHub Actions to their Node 24 majors'.

#### Browser harness early-refusal race ✅ Resolved 2026-09-28

**Resolution:** When a refusal arrived before the triggering click finished, `BrowserBackend` surfaced it as an unhandled rejection. This failed about 1 run in 30 on the Angular and Next.js surfaces. `handledLater()` now marks outcome promises as handled when they are created. After the fix, 60 local runs gave 0 failures.
**See:** PR #9 (`cc98f1d`); [Phase 4 walkthrough](walkthroughs/2026-09-28_phase-4-parity-hardening.md), section 4.

---

## Risk Summary

| Priority | Count | Total Effort | Status Distribution |
|---|---|---|---|
| HIGH (20–30) | 0 | 0 hrs | — |
| MEDIUM (10–19) | 0 | 0 hrs | — |
| LOW (0–9) | 0 | 0 hrs | — |
| **Total Outstanding** | **0** | **0 hrs** | |
| Resolved | 4 | 3 hrs (Risks #1, #2 and #3) | |

---

## Potential Next Steps

These items have not been requested. They are candidates, not commitments.

### LOW Priority

1. **Non-gating Web Vitals job** — effort not estimated, not requested. Measure the Angular and Next.js pages in CI without gating on the result.
2. **`@serenity-js/rest` for the API ability** — effort not estimated, not requested. Replace the hand-written `CallLoanApi` HTTP calls.
3. **`@serenity-js/web` for browser reports** — effort not estimated, not requested. Revisits the trade-off recorded in DR-016.
4. **MSW component-state tier** — effort not estimated, not requested. The optional tier described in DR-011.

---

## Delivered from Potential Next Steps

- **Serenity BDD HTML report** — delivered 2026-09-29 at the owner's request. CI builds one report per surface plus an index page (`npm run report:html`) and publishes them to GitHub Pages from `main`, to give the portfolio landing page a live evidence link.

---

## Maintenance Notes

- Include links or paths to affected files when adding new items.
- Update the version number at the top when items change status.
- Cross-reference code review findings in `.review/`.
- Mark completion dates when items move to ✅ Resolved.
- Update effort estimates with actuals after completion.
- Decisions are recorded in [`DOCS/decision-register.md`](../DOCS/decision-register.md), not in `docs/adr/`.
