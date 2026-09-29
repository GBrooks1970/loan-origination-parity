# Loan Origination Parity

**Status:** Phases 0–4 complete (28 September 2026). The parity gate passed on 10 of 10 CI runs with no retries.
**Origin:** seeded from `project-specs/loan-origination-parity/` in [`test-automation-portfolio`](https://github.com/GBrooks1970/test-automation-portfolio) at `e4b915d` (DR-001)
**Test reports:** [Serenity BDD HTML reports for all four surfaces](https://gbrooks1970.github.io/loan-origination-parity/), published from CI on every green build of `main`
**Why this project:** [`multi-stack-parity-outlines-critique.md`](https://github.com/GBrooks1970/test-automation-portfolio/blob/main/project-specs/potential-project-outlines/multi-stack-parity-outlines-critique.md) §5

A UK unsecured personal loan origination workbench. One domain engine is exercised through four surfaces (in-memory core, Node.js REST API, Angular SPA, Next.js backend-for-frontend) by one Serenity/JS Screenplay harness reading one Gherkin store. The showcase proves **surface portability across three web paradigms** and **server-side authorisation that holds when the UI is bypassed**.

The rules are modelled on UK consumer credit obligations and simplified for testability. They are not a compliance implementation.

## Surfaces

| Surface | Package | Phase | Status |
| :--- | :--- | :--- | :--- |
| Domain core (in-process) | [`packages/domain-core`](packages/domain-core) | 1 | Built |
| Node.js REST API | [`demo-apps/demoapp001-node-service`](demo-apps/demoapp001-node-service) | 1 | Built |
| Angular SPA (underwriter workbench) | [`demo-apps/demoapp002-angular-spa`](demo-apps/demoapp002-angular-spa) | 2 | Built |
| Next.js backend-for-frontend | [`demo-apps/demoapp003-nextjs-bff`](demo-apps/demoapp003-nextjs-bff) | 3 | Built |

## Stability and measured timings (Phase 4, 28 September 2026)

Ten CI runs, started by hand on `main` at `126f304`: **10 of 10 green on the first attempt**, and PARITY PASS (counts and step text) in every run. That is 1,060 scenario executions each on Angular and Next.js, 850 on the API and 330 on the core, with no failures and no retries. Raw per-run data: [`docs/evidence/2026-09-28_phase-4-stability-runs.json`](docs/evidence/2026-09-28_phase-4-stability-runs.json).

Medians of the 10 runs (range in brackets). Suite and scenario times come from the Cucumber message timestamps; set-up is the per-scenario test-control cost.

| Surface | Scenarios | Suite | Scenario p50 | Scenario p95 | Set-up p50 | Set-up p95 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| Domain core | 33 | 4.0 s (3.6–4.2) | 110 ms | 162 ms | — | — |
| API | 85 | 12.0 s (11.5–12.9) | 146 ms | 174 ms | 3.5 ms | 6.5 ms |
| Angular | 106 | 83.6 s (69.7–89.2) | 688 ms | 1,362 ms | 3.4 ms | 6.3 ms |
| Next.js | 106 | 88.3 s (73.4–93.7) | 718 ms | 1,448 ms | 3.4 ms | 6.8 ms |

- **CI run duration:** median 219 s (197–336 s) from start to finish. The three longest runs waited up to about 2.5 minutes for a free runner; their test steps took as long as the others'.
- **Job durations (median):** static 37 s, core 33 s, API 44 s, Angular 149 s, Next.js 160 s, parity gate 11 s.
- **Runner time:** 4,328 job-seconds (72 minutes) across the 10 runs; 101 minutes when each job is rounded up to a whole minute.
- **Set-up target (spec §11: under 200 ms per scenario):** met, with a worst p95 of 8.84 ms in any run.
- **Intermittent harness failure found afterwards:** the next CI run (PR #8) hit a race in the browser harness that about 1 run in 30 triggers. A refusal that arrives before a click finishes surfaced as an unhandled rejection. It was fixed in PR #9 and the fix is carried into PR #8; see the Phase 4 walkthrough, section 4.

## Results (28 September 2026: after a clean `npm ci`, `npm run verify` exited 0 in 290 s)

| Check | Result |
| :--- | :--- |
| domain-core unit tests | 23 / 23 pass |
| Node service contract tests (responses validated against OpenAPI 1.3.0) | 4 / 4 pass |
| Expected-value oracle | 99 values across 40 scenarios agree |
| Domain core surface: `domain-rules` | 33 / 33 |
| API surface: `domain-rules` + `workflows` | 85 / 85 |
| Angular surface: `domain-rules` + `workflows` + `ui-only` | 106 / 106 (1 m 47 s) |
| Next.js surface: `domain-rules` + `workflows` + `ui-only` | 106 / 106 (1 m 53 s) |
| Parity gate (four surfaces, per folder: counts and step text) | PASS |
| Per-scenario set-up, API / Angular / Next.js | p50 6.41 / 5.76 / 6.09 ms, p95 9.66 / 10.56 / 10.40 ms (target under 200 ms) |

## Run it

Requires Node.js 24 LTS (see `.nvmrc`; Node 22.22.3+ also works: Angular CLI 22.2 needs it) and Python 3 for the oracle.

```
npm ci
pip install gherkin-official==42.0.1
npx playwright install chromium        # or set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an existing Chromium
npm run verify
```

`verify` runs typecheck, unit and contract tests, the oracle, all four surfaces and the parity gate. Individual steps:
- `npm run test:core`
- `npm run test:api`: starts the Node service in test mode for the run.
- `npm run test:angular`: builds the SPA with the test configuration and starts the Node service and the SPA's same-origin server. Cucumber arguments go after `--`, e.g. `node tools/run-ui-suite.mjs angular -- --name "Decline notice"`.
- `npm run test:nextjs`: builds the Next.js app (production build) and starts it with `LOP_TEST_MODE=1` next to the Node service. Same `--` pass-through: `node tools/run-ui-suite.mjs nextjs -- --name "ratio of"`.
- `npm run check:parity`: per folder, every targeted surface must pass every scenario, and the passed scenarios must be identical across surfaces (feature file, name, step text and step arguments). It also rejects step definitions that mention a surface.
- `npm run report:timings`: measured suite, scenario and set-up timings per surface, from the run's own reports.
- `npm run report:html`: one Serenity BDD HTML report per surface that has run, plus an index page, in `test-harnesses/harness-serenity/target/site/report/`. It needs Java 17 or later; the Serenity BDD CLI jar comes with `npm ci`.

## CI

`.github/workflows/ci.yml` runs on pushes to `main`, on pull requests and by hand (`workflow_dispatch`):

1. **Static:** typecheck, unit and contract tests, the oracle.
2. **Surface (core / api / angular / nextjs):** the four surfaces in parallel, each uploading its Cucumber messages and Serenity/JS JSON.
3. **Parity gate and measured timings:** after all of the above, collects the four reports, runs the gate and writes the timings table to the job summary.
4. **Serenity BDD HTML reports:** builds the per-surface reports and index page on every run.
5. **Publish reports to GitHub Pages:** on `main` only, and only when the parity gate and the report build both passed.

## Layout

| Path | What it is |
| :--- | :--- |
| [`DOCS/.design/loan-origination-platform-specification.md`](DOCS/.design/loan-origination-platform-specification.md) | The platform specification (v1.5) |
| [`DOCS/decision-register.md`](DOCS/decision-register.md) | DR-001 – DR-018 Accepted; DR-009 records resolved versions |
| [`DOCS/.architecture/openapi.yaml`](DOCS/.architecture/openapi.yaml) | OpenAPI 3.1 contract (1.3.0) |
| [`features-shared/`](features-shared/) | 19 feature files: `domain-rules/` (33), `workflows/` (52), `ui-only/` (21) |
| [`test-harnesses/harness-serenity/`](test-harnesses/harness-serenity/) | Screenplay harness: `CallDomainCore`, `CallLoanApi` and `BrowseTheWorkbench` implement one abstract `OperateTheWorkbench` ability; `UseTheScreens` adds UI-only interactions |
| [`tools/`](tools/) | Oracle, API and UI suite runners, parity gate, timings report, HTML report builder |
| [`docs/walkthroughs/`](docs/walkthroughs/) | Dated delivery records |

## Licence

[MIT](LICENSE), Copyright (c) 2026 Gary Brooks. This matches the portfolio convention for original project code (P-04 decision matrix in `test-automation-portfolio`). Each portfolio repository's own licence is authoritative. Third-party dependencies keep their own terms.
