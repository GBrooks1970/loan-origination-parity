# Loan Origination Parity

**Status:** Phase 4 (parity gate and hardening) — in progress; Phases 1–3 complete
**Origin:** seeded from `project-specs/loan-origination-parity/` in [`test-automation-portfolio`](https://github.com/GBrooks1970/test-automation-portfolio) at `e4b915d` (DR-001)
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

## CI

`.github/workflows/ci.yml` runs on pushes to `main`, on pull requests and by hand (`workflow_dispatch`):

1. **Static:** typecheck, unit and contract tests, the oracle.
2. **Surface (core / api / angular / nextjs):** the four surfaces in parallel, each uploading its Cucumber messages.
3. **Parity gate and measured timings:** after all of the above, collects the four reports, runs the gate and writes the timings table to the job summary.

## Layout

| Path | What it is |
| :--- | :--- |
| [`DOCS/.design/loan-origination-platform-specification.md`](DOCS/.design/loan-origination-platform-specification.md) | The platform specification (v1.5) |
| [`DOCS/decision-register.md`](DOCS/decision-register.md) | DR-001 – DR-018 Accepted; DR-009 records resolved versions |
| [`DOCS/.architecture/openapi.yaml`](DOCS/.architecture/openapi.yaml) | OpenAPI 3.1 contract (1.3.0) |
| [`features-shared/`](features-shared/) | 19 feature files: `domain-rules/` (33), `workflows/` (52), `ui-only/` (21) |
| [`test-harnesses/harness-serenity/`](test-harnesses/harness-serenity/) | Screenplay harness: `CallDomainCore`, `CallLoanApi` and `BrowseTheWorkbench` implement one abstract `OperateTheWorkbench` ability; `UseTheScreens` adds UI-only interactions |
| [`tools/`](tools/) | Oracle, API and UI suite runners, parity gate, timings report |
| [`docs/walkthroughs/`](docs/walkthroughs/) | Dated delivery records |

## Licence

[MIT](LICENSE), Copyright (c) 2026 Gary Brooks. This matches the portfolio convention for original project code (P-04 decision matrix in `test-automation-portfolio`). Each portfolio repository's own licence is authoritative. Third-party dependencies keep their own terms.
