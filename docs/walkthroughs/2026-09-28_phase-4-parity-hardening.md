# Walkthrough: Phase 4 — Parity Gate and Hardening

**Date:** 28 September 2026
**Owner decisions (28 September 2026):** core scope (step-text parity, CI matrix, 10-run stability proof, published timings); stability runs started by hand (`workflow_dispatch`). The Web Vitals job and the MSW component tier were not requested.
**Commits:** `c845bdb` (PR #7, merged as `126f304`); this evidence and documentation PR.

## 1. What was done

- **Step-text parity** (`tools/check-parity.mjs`). Besides counts, the gate now compares which scenarios passed on each surface of a folder, identified by feature file, name, step text and step arguments. This is the part of DR-006 that had been checked only by count.
- **Measured timings** (`tools/report-timings.mjs`, `npm run report:timings`). For each surface: suite time and scenario p50/p95/max from Cucumber message timestamps, plus the harness's own set-up summary. The table goes to the GitHub job summary and to `timings-summary.json`.
- **CI:**
  - Static checks and the four surfaces run as parallel jobs.
  - A fan-in job downloads every surface's reports and runs the gate and the timings report.
  - `workflow_dispatch` is added. Each dispatched run has its own concurrency group, so queued runs don't cancel each other.
- **Evidence and publication:**
  - The raw data for all 10 runs is in `docs/evidence/2026-09-28_phase-4-stability-runs.json`.
  - The medians are in the README.
  - The tri-paradigm playbook's Exhibit 2 (portfolio repository) now has measured speeds; that is a separate PR.

## 2. Evidence

**Negative check (step-text parity).** I changed one step's text in a copy of `nextjs.ndjson` (`the debt service ratio is 25.00 percent` → `… is about 25.00 percent`). The counts stayed at 33/33, but the gate reported `step text DIFFERS from core`, listed the scenario as passed on core but not on nextjs (and the reverse), and exited 1. With the file restored, it exited 0.

**First CI run of the new layout** (PR #7, head `c845bdb`, run `36466465113`): all six jobs passed; 18:37:10 to 18:40:08 UTC (2 minutes 58 seconds), against 4 minutes 31 seconds for the sequential job on PR #5.

**Stability proof.** I started 10 runs on `main` at `126f304` between 18:41:34 and 18:41:57 UTC. Every run completed `success` with `run_attempt` 1, and every run's parity job logged:

```
PARITY PASS — every targeted surface passes the same scenarios, with identical step text, in each of its folders; no step definition branches on surface.
```

| Run | ID | Duration | Angular suite | Next.js suite | API suite | Core suite |
| ---: | :--- | ---: | ---: | ---: | ---: | ---: |
| 16 | 36466982018 | 208 s | 83.3 s | 93.7 s | 12.1 s | 3.6 s |
| 17 | 36467000180 | 212 s | 69.7 s | 89.4 s | 11.5 s | 4.1 s |
| 18 | 36467003121 | 197 s | 89.2 s | 73.4 s | 12.5 s | 3.9 s |
| 19 | 36467006229 | 204 s | 85.0 s | 88.0 s | 11.8 s | 3.6 s |
| 20 | 36467010493 | 212 s | 83.7 s | 89.9 s | 12.8 s | 4.2 s |
| 21 | 36467013424 | 305 s | 85.6 s | 88.6 s | 12.9 s | 4.0 s |
| 22 | 36467017138 | 226 s | 83.4 s | 83.9 s | 11.9 s | 3.8 s |
| 23 | 36467020301 | 233 s | 80.7 s | 84.1 s | 11.6 s | 4.0 s |
| 24 | 36467023225 | 330 s | 83.9 s | 91.0 s | 11.7 s | 3.9 s |
| 25 | 36467026510 | 336 s | 82.8 s | 87.8 s | 12.4 s | 4.0 s |

Runs 21, 24 and 25 took longer because their jobs waited up to about 2.5 minutes for a free runner. Their test steps were in the same range as the other runs.

**Medians of the 10 runs:**

| Surface | Suite | Scenario p50 | Scenario p95 | Set-up p50 | Set-up p95 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Core | 4.0 s | 110 ms | 162 ms | — | — |
| API | 12.0 s | 146 ms | 174 ms | 3.5 ms | 6.5 ms |
| Angular | 83.6 s | 688 ms | 1,362 ms | 3.4 ms | 6.3 ms |
| Next.js | 88.3 s | 718 ms | 1,448 ms | 3.4 ms | 6.8 ms |

**Runner time.** 4,328 job-seconds (72 minutes) over the 10 runs, or 101 minutes with each job rounded up to a whole minute. The usage API reported 0 billable milliseconds for these runs, so the billed figure was not confirmed.

## 3. Exit criteria (critique §5.2, Phase 4)

| Criterion | Result |
| :--- | :--- |
| Gate green on 10 consecutive CI runs with no retries | Met: runs 16–25, all attempt 1, all PARITY PASS |
| Measured timings published | Met: README, evidence JSON, and playbook Exhibit 2 (portfolio PR) |
| Walkthrough archived with SHAs per `AGENTS.md` | This document |

## 4. Notes and limits

- The ten runs were started together and ran in parallel on separate GitHub-hosted runners. They show repeatability across runner instances, not ten runs in sequence on one machine.
- The parity gate still uses Node (`.mjs`), not PowerShell. The roadmap suggested PowerShell only for cross-platform support, which Node already provides.
- The speed figures include Serenity/JS reporting and per-scenario namespace set-up. They are end-to-end suite times, not raw protocol times.
- The CI artifacts could not be downloaded from the build environment, because its egress policy blocks `*.blob.core.windows.net`. Every figure was therefore read from job logs and from the run and job APIs.
- CI actions are still at `@v4`. GitHub warns that they run on Node 20 and are forced onto Node 24. This carried-over candidate is not in the core scope.
