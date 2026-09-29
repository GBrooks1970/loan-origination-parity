# Loan Origination Parity — Backlog

**Version:** 4 — Risk #2 (Ubuntu 26 runner migration) recorded; one outstanding risk
**Last Updated:** 2026-09-29
**Based on:** [Phase 4 walkthrough](walkthroughs/2026-09-28_phase-4-parity-hardening.md) and the CI warnings on every run since Phase 1; version 2 records the resolution of Risk #1; version 4 adds Risk #2 from the runner notice on every CI job

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

#### Risk #2: CI runners move to Ubuntu 26 from 19 October 2026 — Score: 8

**Priority Score:** Security Impact (1) + Breakage Probability (5) + Maintenance Burden (2) = **8 points**
**Impact:** Every CI job will change operating system without a commit in this repository, which could turn `main` red for reasons outside the code.
**Effort:** 1–2 hours
**Status:** READY TO START
**Affected Stacks:** CI (`.github/workflows/ci.yml`; all five jobs use `runs-on: ubuntu-latest`)

**Problem:**
Since 29 September 2026 every CI job has carried this notice: 'The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026' (actions/runner-images#14748). The notice was read from the check-run annotations; the linked issue itself could not be read from the build environment. The steps most exposed to an operating-system change are:
- `npx playwright install --with-deps chromium` (Angular and Next.js jobs), which installs Chromium's system libraries with `apt`;
- `actions/setup-python@v6` with Python 3.12 (static job), which relies on the runner's tool cache;
- `actions/setup-java@v5` with Temurin 21 (report job).

**Impact Analysis:**
- **Security (1/10):** no vulnerability; staying on an older image is supported for now.
- **Breakage (5/10):** browser system libraries and tool-cache versions are the usual casualties of an image change. Nothing has been measured against Ubuntu 26 yet.
- **Maintenance (2/10):** five `runs-on` lines, one workflow file.

**Refactor Strategy:**
1. Before 19 October, run the workflow once with `runs-on: ubuntu-26.04` (by hand, on a branch) and compare it with the current `ubuntu-latest` run. The label must exist on GitHub-hosted runners by then.
2. If it is green, keep `ubuntu-latest` and close this risk with the evidence.
3. If it is red, pin `runs-on: ubuntu-24.04` until the failure is fixed, and record the pin in `ci.yml`.

**Success Criteria:**
- [ ] One full CI run on Ubuntu 26 (all jobs green, PARITY PASS, reports built), or an explicit `ubuntu-24.04` pin with the reason recorded.
- [ ] The runner notice no longer appears as an unknown on the project's CI.

---

### Resolved Risks

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
| LOW (0–9) | 1 | 1–2 hrs | 1 READY TO START |
| **Total Outstanding** | **1** | **1–2 hrs** | |
| Resolved | 2 | 1 hr (Risk #1) | |

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
