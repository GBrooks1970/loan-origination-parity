# Loan Origination Parity — Backlog

**Version:** 1 — initial backlog, created at portfolio onboarding
**Last Updated:** 2026-09-29
**Based on:** [Phase 4 walkthrough](walkthroughs/2026-09-28_phase-4-parity-hardening.md) and the CI warnings on every run since Phase 1

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

#### Risk #1: CI actions run on the deprecated Node 20 runtime — Score: 9

**Priority Score:** Security Impact (1) + Breakage Probability (5) + Maintenance Burden (3) = **9 points**
**Impact:** CI will break when GitHub stops forcing the `@v4` actions onto Node 24 or removes Node 20.
**Effort:** 1 hour
**Status:** READY TO START
**Affected Stacks:** CI (`.github/workflows/ci.yml`)

**Problem:**
`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4` and `actions/download-artifact@v4` target Node 20. Every CI run logs GitHub's deprecation warning that they are being forced onto Node 24. The pipeline passes today, but relies on that forced upgrade.

**Impact Analysis:**
- **Security (1/10):** no known vulnerability; only the unsupported runtime.
- **Breakage (5/10):** GitHub has announced the change; the date is outside this project's control.
- **Maintenance (3/10):** four action references across three jobs.

**Refactor Strategy:**
1. Move each action to the first major version that targets Node 24.
2. Confirm that artifact names and the fan-in download in the `parity` job still match.
3. Run CI on a PR and confirm that the warning has gone.

**Success Criteria:**
- [ ] No Node 20 deprecation warning in any CI job.
- [ ] All six CI jobs green, with PARITY PASS.

---

### Resolved Risks

#### Browser harness early-refusal race ✅ Resolved 2026-09-28

**Resolution:** When a refusal arrived before the triggering click finished, `BrowserBackend` surfaced it as an unhandled rejection. This failed about 1 run in 30 on the Angular and Next.js surfaces. `handledLater()` now marks outcome promises as handled when they are created. After the fix, 60 local runs gave 0 failures.
**See:** PR #9 (`cc98f1d`); [Phase 4 walkthrough](walkthroughs/2026-09-28_phase-4-parity-hardening.md), section 4.

---

## Risk Summary

| Priority | Count | Total Effort | Status Distribution |
|---|---|---|---|
| HIGH (20–30) | 0 | 0 hrs | — |
| MEDIUM (10–19) | 0 | 0 hrs | — |
| LOW (0–9) | 1 | 1 hr | 1 READY TO START |
| **Total Outstanding** | **1** | **1 hr** | |
| Resolved | 1 | — | |

---

## Potential Next Steps

These items have not been requested. They are candidates, not commitments.

### LOW Priority

1. **Non-gating Web Vitals job** — effort not estimated, not requested. Measure the Angular and Next.js pages in CI without gating on the result.
2. **`@serenity-js/rest` for the API ability** — effort not estimated, not requested. Replace the hand-written `CallLoanApi` HTTP calls.
3. **Serenity BDD HTML report** — effort not estimated, not requested. Would give the project a publishable evidence artefact.
4. **`@serenity-js/web` for browser reports** — effort not estimated, not requested. Revisits the trade-off recorded in DR-016.
5. **MSW component-state tier** — effort not estimated, not requested. The optional tier described in DR-011.

---

## Maintenance Notes

- Include links or paths to affected files when adding new items.
- Update the version number at the top when items change status.
- Cross-reference code review findings in `.review/`.
- Mark completion dates when items move to ✅ Resolved.
- Update effort estimates with actuals after completion.
- Decisions are recorded in [`DOCS/decision-register.md`](../DOCS/decision-register.md), not in `docs/adr/`.
