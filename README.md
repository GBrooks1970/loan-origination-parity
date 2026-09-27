# Loan Origination Parity

**Status:** Phase 1 (headless system under test) — in review
**Origin:** seeded from `project-specs/loan-origination-parity/` in [`test-automation-portfolio`](https://github.com/GBrooks1970/test-automation-portfolio) at `e4b915d` (DR-001)
**Why this project:** [`multi-stack-parity-outlines-critique.md`](https://github.com/GBrooks1970/test-automation-portfolio/blob/main/project-specs/potential-project-outlines/multi-stack-parity-outlines-critique.md) §5

A UK unsecured personal loan origination workbench. One domain engine is exercised through four surfaces (in-memory core, Node.js REST API, Angular SPA, Next.js backend-for-frontend) by one Serenity/JS Screenplay harness reading one Gherkin store. The showcase proves **surface portability across three web paradigms** and **server-side authorisation that holds when the UI is bypassed**.

The rules are modelled on UK consumer credit obligations and simplified for testability. They are not a compliance implementation.

## Surfaces

| Surface | Package | Phase | Status |
| :--- | :--- | :--- | :--- |
| Domain core (in-process) | [`packages/domain-core`](packages/domain-core) | 1 | Built |
| Node.js REST API | [`demo-apps/demoapp001-node-service`](demo-apps/demoapp001-node-service) | 1 | Built |
| Angular SPA | `demo-apps/demoapp002-angular-spa` | 2 | Not started |
| Next.js backend-for-frontend | `demo-apps/demoapp003-nextjs-bff` | 3 | Not started |

## Results (27 September 2026, local run of `npm run verify`)

| Check | Result |
| :--- | :--- |
| domain-core unit tests | 20 / 20 pass |
| Node service contract tests (responses validated against OpenAPI) | 4 / 4 pass, 16 response bodies schema-checked |
| Expected-value oracle | 99 values across 40 scenarios agree |
| `features-shared/domain-rules` on domain core | 33 / 33 scenarios pass |
| `features-shared/domain-rules` + `workflows` on API | 82 / 82 scenarios pass |
| Parity gate | PASS |
| Per-scenario set-up on the API surface | p50 4.32 ms, p95 7.38 ms, max 49.99 ms (target under 200 ms) |

## Run it

Requires Node.js 24 LTS (see `.nvmrc`; Node 22.22.2+ also works) and Python 3 for the oracle.

```
npm ci
pip install gherkin-official==42.0.1
npm run verify
```

`verify` runs typecheck, unit and contract tests, the oracle, both surfaces and the parity gate. Individual steps: `npm run test:core`, `npm run test:api` (starts the Node service in test mode for the run), `npm run check:parity`.

## Layout

| Path | What it is |
| :--- | :--- |
| [`DOCS/.design/loan-origination-platform-specification.md`](DOCS/.design/loan-origination-platform-specification.md) | The platform specification (v1.2) |
| [`DOCS/decision-register.md`](DOCS/decision-register.md) | DR-001 – DR-013, all Accepted; DR-009 records resolved versions |
| [`DOCS/.architecture/openapi.yaml`](DOCS/.architecture/openapi.yaml) | OpenAPI 3.1 contract (1.1.0) |
| [`features-shared/`](features-shared/) | 19 feature files: `domain-rules/` (33), `workflows/` (49), `ui-only/` (21) |
| [`test-harnesses/harness-serenity/`](test-harnesses/harness-serenity/) | Screenplay harness: `CallDomainCore` and `CallLoanApi` implement one abstract `OperateTheWorkbench` ability |
| [`tools/`](tools/) | Oracle, API-suite runner, parity gate |
| [`docs/walkthroughs/`](docs/walkthroughs/) | Dated delivery records |

## Licence

Not yet chosen. The portfolio has set licences per project; this is an open decision for the owner.
