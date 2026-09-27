# Walkthrough: Phase 1 — Headless System Under Test

**Date:** 27 September 2026
**Branch:** `phase-1/headless-sut` (base `main` @ `940c6c2`, the Phase 0 seed)

## 1. What was done

| Commit | Change |
| :--- | :--- |
| `940c6c2` (on `main`) | Repository seeded with the accepted Phase 0 pack (DR-001). The only commit made directly to `main`: an empty repository has no base for a PR |
| `73a59a5` | `packages/domain-core`: rules R01–R04, lifecycle with lazy expiry, nine ordered authorisation checks, audit, decline notice, in-memory ports |
| `e16fed7` | Serenity/JS harness with the domain-core surface |
| `336e073` | `demoapp001-node-service`: Express 5 API, namespaces, fixture sessions, test-control routes, OpenAPI contract test |
| `03e181b` | API surface in the harness, scenario-isolation fix, parity gate |
| this commit | CI workflow, DR-009 versions, spec v1.2 amendments, README, this walkthrough |

## 2. Evidence (captured output, `npm run verify`, exit 0)

```
domain-core unit tests:   # tests 20  # pass 20  # fail 0
node-service contract:    # tests 4   # pass 4   # fail 0
Checked 99 expected values across 40 scenarios and the §13 fixtures.
PASS — every checked expected value agrees with the reference model.
Scenarios:  33            (domain-core surface)
Per-scenario set-up (api): p50 4.32 ms, p95 7.38 ms, max 49.99 ms over 82 scenarios
Scenarios:  82            (API surface)
domain-rules   core   33 passed /  33 run / 33 in Gherkin
domain-rules   api    33 passed /  33 run / 33 in Gherkin
workflows      api    49 passed /  49 run / 49 in Gherkin
PARITY PASS — every targeted surface passes every scenario in its folders; no step definition branches on surface.
```

Negative checks, each restored afterwards:
- Two corrupted expected values in `domain-rules/` produced two failures with precise messages ("Expected the debt service ratio to equal "35.01"").
- A corrupted value made `npm run test:core` exit 1.
- The parity gate failed on a stale report with 32 of 33 passing.

## 3. Defect found and fixed during the phase

**Scenario isolation was silently broken.** The Cucumber profile paired `@serenity-js/cucumber` with Cucumber's `summary` formatter. Cucumber keeps only one stdout formatter, so the Serenity formatter was dropped. Serenity then received no scene events and never dismissed actors, and every scenario reused the first scenario's backend (confirmed: 1 distinct backend across 33 scenarios). It surfaced as four API failures on "no application has been created", because all scenarios shared one namespace. After the fix, 33 scenarios used 33 distinct backends and the four failures cleared. The earlier "33 / 33" domain-core result had been real assertions running against a shared engine; it was re-established under isolation.

## 4. Decisions and amendments
- **DR-009 versions recorded.** TypeScript is pinned to 6.0.3, not npm's `latest` 7.0.2, because Angular 22.2 accepts only TypeScript 6.0.x.
- **Spec v1.2:**
  - `REASON_REQUIRED` added for a blank manual-decline reason;
  - HTTP-layer codes documented;
  - OpenAPI 1.1.0 adds `/health` and the transport codes.
- **Open question for the owner:** should a human review restart the 30-day expiry window? Today it doesn't, so a review requested on day 30 expires almost immediately.

## 5. Not done / known limits
- CI is defined but had not yet run when this was written; the first run is on the Phase 1 PR.
- The API ability is fetch-based (`CallLoanApi`), not `@serenity-js/rest` `CallAnApi`, so HTTP exchanges do not appear as Serenity report artefacts yet.
- No Serenity BDD HTML report; the console reporter and Cucumber messages are the evidence.
- No licence file; the choice is the owner's.
