# Loan Origination Parity — Backlog

**Version:** 7 — Risk #3 extended to cover `build-reports.mjs` and `report-timings.mjs` (Windows); version 6 added Risk #3; Risk #2 (Ubuntu 26 runner migration) resolved by a green trial run
**Last Updated:** 2026-10-07
**Based on:** [Phase 4 walkthrough](walkthroughs/2026-09-28_phase-4-parity-hardening.md) and the CI warnings on every run since Phase 1; version 2 records the resolution of Risk #1; version 4 adds Risk #2 from the runner notice on every CI job; version 5 records its resolution

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

#### Risk #3: the parity gate and report scripts do not run on Windows — Score 5 (Security 0 + Breakage 3 + Maintenance 2) — READY TO START

**Evidence (tested, 6 October 2026, Windows, Node 24.18.0):** `npm run check:parity` exited 1 in 4 s after all four suites had passed (33, 85, 106 and 106 scenarios). It fails in two places in `tools/check-parity.mjs`:
1. Line 9, `const root = new URL('..', import.meta.url).pathname;`, gives `/D:/…` on Windows, which is then joined into a doubled drive path: `ENOENT: no such file or directory, scandir 'D:\D:\…\features-shared\domain-rules'`. `fileURLToPath` gives the right path.
2. Line 55, `pickles.get(pickleId).split('features-shared/')[1]`, assumes forward slashes. On Windows the reports record `"uri":"..\\..\\features-shared\\domain-rules\\age-eligibility.feature"` (JSON-escaped backslashes), so the split returns `undefined` and the script throws `Cannot read properties of undefined (reading 'split')`.

**Evidence (tested, 7 October 2026, Windows, Node 24.18.0):** `spawnSync('npx', …)` without a shell fails on Windows (`ENOENT`; `spawnSync('npm.cmd', …)` gives `EINVAL`; `shell: true` works). `tools/build-reports.mjs:50` uses exactly that pattern for `npx serenity-bdd run`, so `npm run report:html` cannot reach its Serenity step on Windows. The call pattern is proven; `report:html` itself was not run (it also needs Java 17 or later).

**Same assumptions, found by reading only (not run):**
- `tools/build-reports.mjs:17` and `tools/report-timings.mjs:9` use the same `new URL(…).pathname` root.
- `tools/check-parity.mjs:70` and `tools/build-reports.mjs:147-148` split `uri` on `features-shared/`.
- `tools/build-reports.mjs:202`, `pickle.uri.includes('features-shared/domain-rules/')`, would be **silently false** on backslash URIs, so domain-rules rows could be skipped without an error. This is the most important one to confirm, because it fails quietly.

**Impact:** CI runs on Linux and is unaffected. A contributor on Windows cannot run the gate or build the report natively. With the `uri` separators normalised in a scratch copy of the reports and the unmodified `check-parity.mjs` run in a `node:24` container, it reported `PARITY PASS` (33/33, 52/52, 21/21), so the reports are sound and the scripts are at fault.
**Suggested fix:** use `fileURLToPath` for every `root`, and normalise `uri` separators once, through a shared helper, before any `features-shared/` split or `includes`. Run `serenity-bdd` with `shell: true` (or through `process.execPath` and the CLI entry). Add unit tests that feed both scripts a backslash URI, including one asserting that domain-rules rows are not dropped. Optionally add a `windows-latest` CI job that runs `check:parity` and `report:html`; that is a CI change and is not required for the fix.
**Effort:** about 2 hrs (estimate, not measured; up from 1 hr).
**Status:** READY TO START — not requested.
**See:** `docs/walkthroughs/2026-10-07_learning-paths-stage-2-5.md` in the portfolio repository (PR GBrooks1970/test-automation-portfolio#280), finding 8 in `portfolio-docs/PORTFOLIO_LEARNING_PATHS.md`, and the 7 October 2026 sweep of `child_process` calls across the portfolio.
---

### Resolved Risks

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
| LOW (0–9) | 1 | 2 hrs | READY TO START |
| **Total Outstanding** | **1** | **2 hrs** | |
| Resolved | 3 | 2 hrs (Risks #1 and #2) | |

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
