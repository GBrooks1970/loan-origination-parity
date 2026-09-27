# Loan Origination Parity

**Status:** Phase 0 complete — accepted by the owner on 27 September 2026
**Replaces:** PRJ-01 / candidate Alpha in the V1 and V2 multi-stack parity outlines, with candidate Delta's authority rules folded in
**Why:** [`multi-stack-parity-outlines-critique.md`](https://github.com/GBrooks1970/test-automation-portfolio/blob/main/project-specs/potential-project-outlines/multi-stack-parity-outlines-critique.md) §5, in the portfolio support repository
**Origin:** seeded from `project-specs/loan-origination-parity/` in [`test-automation-portfolio`](https://github.com/GBrooks1970/test-automation-portfolio) at `e4b915d` (DR-001)

A UK unsecured personal loan origination workbench. One domain engine is exercised through four surfaces (in-memory core, Node.js REST API, Angular SPA, Next.js backend-for-frontend) by one Serenity/JS Screenplay harness reading one Gherkin store. The showcase proves **surface portability across three web paradigms** and **server-side authorisation that holds when the UI is bypassed**.

The rules are modelled on UK consumer credit obligations and simplified for testability. They are not a compliance implementation.

## Contents

| Path | What it is |
| :--- | :--- |
| [`DOCS/.design/loan-origination-platform-specification.md`](DOCS/.design/loan-origination-platform-specification.md) | Rules, state machine, roles, audit, decline notice, UI contract, test-control API, step glossary, fixtures |
| [`DOCS/decision-register.md`](DOCS/decision-register.md) | DR-001 – DR-013 (all Accepted, 27 September 2026) |
| [`DOCS/.architecture/openapi.yaml`](DOCS/.architecture/openapi.yaml) | OpenAPI 3.1 contract for the Node service, including test-control endpoints |
| [`features-shared/domain-rules/`](features-shared/domain-rules/) | 8 features, 33 scenarios — core, API, Angular, Next.js |
| [`features-shared/workflows/`](features-shared/workflows/) | 8 features, 49 scenarios — API, Angular, Next.js |
| [`features-shared/ui-only/`](features-shared/ui-only/) | 3 features, 21 scenarios — Angular, Next.js |
| [`tools/check-expected-values.py`](tools/check-expected-values.py) | Independent decimal oracle that re-derives every rule outcome written in the Gherkin |

Scenario counts are after Scenario Outline expansion: 103 in total, or 321 scenario runs across their target surfaces.

## Verify the expected values

```
pip install gherkin-official
python3 tools/check-expected-values.py
```

Result on 26 September 2026: `Checked 99 expected values across 40 scenarios and the §13 fixtures. PASS`.

## Owner decisions recorded (26 September 2026)

UK regulatory regime · this in-portfolio location (DR-001: it becomes its own repository at Phase 1, like every other project) · current stable framework majors resolved at Phase 1 (DR-009) · TypeScript harness only (DR-013).

## Next — Phase 1

1. Record the framework versions resolved on the day Phase 1 starts in DR-009.
2. Lift this folder into `loan-origination-parity/` at the portfolio root, add it to the root `.gitignore`, and initialise it as its own repository (DR-001). Mark this copy as the historical Phase 0 input.
3. Build `packages/domain-core` (rules, state machine, authorisation, audit, ports) and `demoapp001-node-service` with the test-control API.
4. Build the `CallDomainCore` and `CallAnApi` abilities; `domain-rules/` green on both surfaces with identical counts, and reset timings measured.
