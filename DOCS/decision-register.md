# Decision Register — Loan Origination Parity

**Last Updated:** 2026-09-27
**Scope:** Phase 0 architectural decisions for the loan origination parity showcase
**Template:** `templates/decision-record.template.md`

All thirteen records were accepted by the owner on 27 September 2026 ("accept all"), following the Phase 0 review. DR-001, DR-002, DR-009 and DR-013 record owner directions given on 26 September 2026 (UK regime, in-portfolio location, current framework versions, TypeScript harness only).

| DR | Title | Status |
| :--- | :--- | :--- |
| DR-001 | Phase 0 lives in the support layer; the project becomes its own repository at scaffold | Accepted (2026-09-27) |
| DR-002 | UK regulatory model, simplified and labelled as modelled | Accepted (2026-09-27) |
| DR-003 | Fold candidate Delta into Alpha with a bounded scope | Accepted (2026-09-27) |
| DR-004 | Next.js is a backend-for-frontend; the Node service is the single state authority | Accepted (2026-09-27) |
| DR-005 | Test-control API with per-scenario namespaces instead of global reset | Accepted (2026-09-27) |
| DR-006 | Three-folder feature store with per-folder parity gates | Accepted (2026-09-27) |
| DR-007 | Locator contract: roles for controls, `data-value` for values | Accepted (2026-09-27) |
| DR-008 | Decimal money as strings; half-even rounding before comparison | Accepted (2026-09-27) |
| DR-009 | Current stable framework majors, resolved at Phase 1 start | Accepted (2026-09-27) |
| DR-010 | Server Actions tested through the browser only | Accepted (2026-09-27) |
| DR-011 | Mock only the credit reference agency, inside the Node service | Accepted (2026-09-27) |
| DR-012 | Fixture identity, not a real identity provider | Accepted (2026-09-27) |
| DR-013 | TypeScript Serenity/JS harness only | Accepted (2026-09-27) |
| DR-014 | UIs are served same-origin with the API behind a thin proxy | Proposed (Phase 2) |
| DR-015 | Action affordances are computed by the server, not re-derived by UIs | Proposed (Phase 2) |
| DR-016 | Browser surfaces implement the workbench ability with Playwright directly | Proposed (Phase 2) |

---

## DR-001: Phase 0 lives in the support layer; the project becomes its own repository at scaffold

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26
**Supersedes:** —
**Superseded by:** —

### Context

The owner chose an in-portfolio location over a new repository. The portfolio root repository tracks only the support layer; every built project is its own gitignored repository (`.gitignore`).

### Decision

Phase 0 artefacts (specification, OpenAPI, decisions, features, oracle) live under `project-specs/loan-origination-parity/`, laid out in the Sudoku shape (`DOCS/`, `features-shared/`). At Phase 1 the folder is copied into a new project directory `loan-origination-parity/` at the portfolio root, added to `.gitignore` like its siblings, and becomes its own repository. The support-layer copy is then marked as a historical Phase 0 input.

### Status

Accepted by the owner on 27 September 2026, confirming the direction given on 26 September 2026.

### Consequences

- Phase 0 is reviewable in this repository today.
- The layout needs no restructuring when lifted.
- Two copies exist briefly at Phase 1. The support-layer copy must be frozen with a pointer to the project repository.

### Alternatives Considered

- **Create the project folder now inside the root repo** — conflicts with the root's support-layer-only rule and would later need history surgery.
- **New repository immediately** — declined by the owner.

---

## DR-002: UK regulatory model, simplified and labelled as modelled

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

The V1/V2 outlines used US rules (FCRA, ECOA, USD, LTV on an unsecured loan). The owner chose a UK regime.

### Decision

Model the rules on FCA CONC 5.2A (affordability), the Consumer Duty (consumer understanding), CCA 1974 s.157 (credit reference agency disclosure) and UK GDPR Article 22 (human review). Use GBP and the `Europe/London` business calendar. Every document states that the rules are simplified and modelled, not a compliance implementation. Thresholds (DSR bands, 300.00 residual, 30-day windows) are illustrative values chosen for testability.

### Consequences

- The domain reads as credible to a UK reviewer.
- Any claim of regulatory accuracy must be avoided in READMEs and reports.
- LTV is dropped because the product is unsecured.

### Alternatives Considered

- **US regime as outlined** — owner preference was UK, and the outline's LTV-on-unsecured error disappears with the change.
- **Jurisdiction-neutral rules** — lose the credibility that named obligations bring.

---

## DR-003: Fold candidate Delta into Alpha with a bounded scope

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

The critique ranked Delta (RBAC) as the best fit for Server Components and Server Actions, but a poor standalone addition because `auth-separation` and `auth-separation-screenplay-poc` already cover identity and RBAC.

### Decision

Include role-based approval limits, maker–checker, referral authority, role-conditional rendering, server-side enforcement with `@security` bypass scenarios, and denial auditing. Exclude policy combining algorithms, policy authoring, break-glass access and policy versioning beyond a rule-set label.

### Consequences

- Alpha gains the server-enforcement story that makes the Next.js stack worth building.
- Scope stays small enough for one domain.
- Delta is withdrawn as a standalone candidate.

### Alternatives Considered

- **Standalone Delta** — duplicates existing portfolio coverage.
- **Full ABAC/policy engine inside Alpha** — doubles the domain and dilutes the loan story.

---

## DR-004: Next.js is a backend-for-frontend; the Node service is the single state authority

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

V2 never said whether the UI stacks call the Node service or re-implement the engine. Re-implementation triples drift risk; a Next.js app that fetches only from the browser is a second SPA and adds no paradigm signal.

### Decision

`packages/domain-core` is imported at runtime only by the Node service (and by the harness for the domain-core surface). Angular calls the Node API from the browser. Next.js Server Components read from the Node API, and Server Actions write to it; it contains no domain rules.

### Consequences

- One reset or namespace covers all stacks.
- UI parity proves rendering and transport equivalence over one engine. That is the honest claim, and READMEs must word it that way.
- The Next.js server-to-API fetch seam is real, so the server/client boundary is genuinely exercised.
- Every data route must be dynamic so `next build` does not call the API.

### Alternatives Considered

- **Each UI stack imports `domain-core` directly** — Angular would evaluate in the browser, exposing rules client-side and forking state.
- **Next.js re-implements rules in Server Actions** — three engines to keep in step.

---

## DR-005: Test-control API with per-scenario namespaces instead of global reset

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

No outline specified a reset mechanism. Global reset serialises parallel workers and races under concurrency.

### Decision

The Node service exposes `/__test__/namespaces/{ns}/…` endpoints (reset, staff, clock, bureau) only when `APP_MODE=test`, guarded by `X-Test-Control-Token`. Every request carries `X-Test-Namespace`; the harness allocates one namespace per scenario. Browser stacks propagate it via a `test-namespace` cookie (spec §11).

### Consequences

- Parallel scenarios cannot see each other's state.
- Reset cost is proportional to one scenario's data.
- The test-only code path must be proven absent from production builds (a Phase 1 check: request without `APP_MODE=test` returns 404).

### Alternatives Considered

- **Global `POST /__test__/reset` before each scenario** — forces serial execution.
- **Restarting the service or container** — seconds per scenario.
- **SQLite file per scenario** — persistence is not the subject; in-memory ports suffice.

---

## DR-006: Three-folder feature store with per-folder parity gates

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

V2 tagged UI-only assertions as `@tri-parity`, creating hidden conditionals or hollow assertions on the API stack.

### Decision

`features-shared/domain-rules/` runs on domain core, API, Angular and Next.js. `workflows/` runs on API, Angular and Next.js. `ui-only/` runs on Angular and Next.js. Folder, not tag, decides reach. The parity gate compares passed-scenario counts and step text per folder across its target surfaces. A step definition that branches on the current surface is a gate failure (grep check in Phase 2).

### Consequences

- Each folder's parity claim is exact.
- Business tags (`@affordability`, `@authority`, `@security`) stay free for reporting.

### Alternatives Considered

- **Tag-driven reach** — tags drift and are easy to misapply.
- **One folder, all surfaces** — forces UI-only content onto the API.

---

## DR-007: Locator contract — roles for controls, `data-value` for values

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

V2's example used CSS unions of `data-testid` and `aria-label`, contradicting its own accessibility claim and hiding which UI drifted.

### Decision

Controls are located by ARIA role and accessible name (`By.role`). Read-only values carry `data-testid` plus a canonical `data-value`. Hidden actions render an `action-unavailable` marker with `data-action` and `data-reason`. No union selectors.

### Consequences

- Both UIs must use identical accessible names; that is part of the contract.
- Parity assertions never depend on currency or date formatting.

### Alternatives Considered

- **`data-testid` everywhere** — weakens the accessibility signal.
- **Text-based assertions** — break on legitimate formatting differences between Angular pipes and `Intl`.

---

## DR-008: Decimal money as strings; half-even rounding before comparison

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

Floating-point arithmetic produces 35.01 for the case (400.30 + 300.00) / 2000.00 × 100, where the correct half-even result is 35.02 (verified by the Phase 0 oracle).

### Decision

`domain-core` uses a decimal library for all money and ratios. Money is serialised as two-decimal strings. DSR is rounded half-even to two places before threshold comparison.

### Consequences

- `domain-rules/dsr-rounding.feature` fails any float implementation.
- JSON consumers must not parse money into JavaScript numbers.

### Alternatives Considered

- **Integer pence** — works for money but not for the DSR percentage.
- **Half-up rounding** — common, but the tie cases would then be untestable as a deliberate rule.

---

## DR-009: Current stable framework majors, resolved at Phase 1 start

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

The outlines pinned Angular 19 and Next.js 15, both superseded by September 2026. PRJ-02 relied on a feature that was experimental in Next.js 15.

### Decision

Use the latest stable major of Node.js LTS, TypeScript, Angular, Next.js, Serenity/JS, Cucumber.js and Playwright available on the day Phase 1 starts. Resolve the exact versions from the npm registry, pin them exactly in lockfiles, and record them in a table appended to this DR. Use no experimental or canary feature flags.

### Consequences

- Version numbers are deliberately absent from Phase 0 documents.
- Upgrades after Phase 1 are ordinary backlog items.

### Alternatives Considered

- **Keep Angular 19 / Next.js 15** — declined by the owner; both are dated at build time.
- **Pin versions now** — risks recording numbers that are stale or wrong before scaffolding.

---

### Resolved versions (Phase 1 start, 27 September 2026)

Resolved from the npm registry and nodejs.org on 27 September 2026, checked twice (before the repository was created and again at Phase 1 start) with identical results. Pinned exactly in `package.json` files and `package-lock.json`.

| Component | Version | Note |
| :--- | :--- | :--- |
| Node.js LTS | 24.21.0 ("Krypton") | `.nvmrc`; Serenity/JS 3.48 requires `^22.22.2 \|\| ^24.15.0` |
| TypeScript | 6.0.3 | **Not 7.0.2** (npm `latest`): Angular 22.2's compiler accepts `>=6.0 <6.1` only, and the workspace uses one compiler |
| Serenity/JS (core, cucumber, assertions, console-reporter) | 3.48.0 | |
| Cucumber.js | 13.2.1 | |
| Express | 5.2.1 | |
| Zod | 4.6.5 | |
| decimal.js | 10.6.0 | |
| tsx | 4.23.15 | TypeScript execution for tests and the harness |
| @types/node | 24.19.0 | Matches the Node 24 LTS line |
| Angular (Phase 2) | 22.2.0 | Recorded now; installed in Phase 2 after re-checking |
| Next.js / React (Phase 3) | 16.3.6 / 19.3.0 | Recorded now; installed in Phase 3 after re-checking |
| Playwright (Phase 2) | 1.63.0 | Re-checked and installed 28 September 2026 |
| Angular (Phase 2, installed) | 22.2.0 | Re-checked 28 September 2026. **Angular CLI 22.2 requires Node `>=22.22.3` or `>=24.15.0`**, so the workspace `engines` minimum rose from 22.22.2 to 22.22.3. CI uses 24.21.0 from `.nvmrc` |
| @axe-core/playwright | 4.13.0 | Phase 2 accessibility checks |

---

## DR-010: Server Actions tested through the browser only

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

Headless invocation of Server Actions depends on build-specific hashed action IDs in the `Next-Action` header and a Flight-encoded body. Mocking action responses with `page.route()` means fabricating Flight payloads.

### Decision

Server Actions are exercised only through a real browser. Refusal scenarios use the step `{actor} forces the "{command}" command on the application`, realised per surface:

- **API:** a direct HTTP call with the actor's session.
- **Angular:** a direct Node API call made with the SPA's own session cookie, from the actor's browser context.
- **Next.js:** the harness opens the target application in a second browser context signed in as a staff member who *is* offered the command, captures that rendered form (action ID and fields) from the DOM at run time, then submits it from the forcing actor's context with the actor's session cookie. Action IDs are discoverable by any user, so this is the realistic threat; they are never read from build output.

`page.route()` may observe action requests but never fulfil them.

### Consequences

- The refusal scenarios exercise the real enforcement path on every stack.
- No test artefact depends on a build hash.
- The Next.js realisation needs a helper staff member of sufficient authority in the namespace; the Background staff table always provides one (Sam).

### Alternatives Considered

- **Replay the action ID from build output** — brittle, and couples the suite to a build.
- **Tamper only with forms the forcing actor is shown** — impossible for an auditor, who is never shown an approval form.
- **Expose a test-only route handler per action** — tests a path production never uses.

---

## DR-011: Mock only the credit reference agency, inside the Node service

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

Mocking the Next.js server's upstream with MSW would replace the first-party engine under test and void the parity claim.

### Decision

The only external dependency is `CreditBureauGateway`. In test mode it is a deterministic fixture set through `/__test__/…/bureau/{applicantRef}`. Nothing mocks the Node service in a parity run. MSW may be used only in an optional, separately tagged Next.js component-state tier (loading, error, empty) outside the parity gate.

### Consequences

- Every parity scenario runs the real engine.
- Error and loading states on Next.js need the optional tier if they are to be tested.

### Alternatives Considered

- **Dual-seam MSW plus `page.route()` as in the playbook** — hollows out the parity claim.

---

## DR-012: Fixture identity, not a real identity provider

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

Authorisation is in scope; authentication is not. `auth-separation*` already demonstrates real identity flows.

### Decision

In test mode, `POST /api/v1/session` issues a signed session for a username present in the namespace's staff directory. Both UIs offer a test-mode `/sign-in` page listing seeded staff. The session carries the username only; roles are resolved server-side from the directory on every request.

### Consequences

- Role changes take effect immediately, which is useful for authority scenarios.
- The sign-in page and session endpoint must be absent outside test mode (Phase 1 check).

### Alternatives Considered

- **OIDC with a local IdP container** — infrastructure without domain signal; adds a service to boot.
- **Roles in the token** — lets a tampered client claim a role, which the `@security` scenarios would then have to model.

---

## DR-013: TypeScript Serenity/JS harness only

**Status:** Accepted (owner, 2026-09-27)
**Date:** 2026-09-26

### Context

The Sudoku reference proves parity across TypeScript, Python and C# harnesses. This project proves parity across SUT paradigms instead.

### Decision

One harness: TypeScript, Serenity/JS, Cucumber.js, Playwright. Python and C# harnesses are out of scope. READMEs describe the project as surface portability across paradigms, not multi-language harness parity.

### Consequences

- Build effort goes into the three SUTs and the parity gate.
- The feature store stays harness-language-neutral in case a second harness is added later.

### Alternatives Considered

- **Sudoku-style multi-language harnesses** — triples harness work for a claim Sudoku already makes.

---

## DR-014: UIs are served same-origin with the API behind a thin proxy

**Status:** Proposed (Phase 2, 28 September 2026)
**Date:** 2026-09-28

### Context

The Angular SPA calls the Node API from the browser (DR-004). Served on different ports, that needs CORS with credentials and cross-site cookie handling, all incidental to the domain.

### Decision

Each UI's build is served by a small Node server (`demo-apps/demoapp002-angular-spa/server.mjs`) that serves the static files, falls back to `index.html` for SPA routes, and proxies `/api/*` and `/health` to the Node service. It forwards only `content-type`, `cookie` and `x-test-namespace`, and relays `set-cookie`. The browser sees one origin.

### Consequences

- No CORS configuration; the session cookie stays first-party.
- The proxy is part of the UI surface under test. It is deliberately minimal and holds no logic.

### Alternatives Considered

- **CORS with credentials between :4200 and :8000** — extra configuration and cookie edge cases that test nothing about lending.
- **Angular dev-server proxy** — dev servers are for the inner loop; CI runs production-style builds.

---

## DR-015: Action affordances are computed by the server, not re-derived by UIs

**Status:** Proposed (Phase 2, 28 September 2026)
**Date:** 2026-09-28

### Context

The workbench must offer only the actions a user may take and say why others are unavailable (`ui-only/role-based-affordances.feature`). Re-implementing the §7.2 checks in each UI would duplicate the rules (against DR-004). The review-window check also depends on the server's virtual clock, which a browser cannot see.

### Decision

`domain-core` exposes `availableActions()` and `staffActions()`, a dry run of the §7.2 checks that writes no audit event. The Node service serves them as `GET /api/v1/applications/{id}/actions` and `GET /api/v1/me/actions` (OpenAPI 1.3.0). UIs render a button when an action is available and otherwise an `action-unavailable` marker carrying the code.

### Consequences

- One source of authorisation truth; Next.js reuses the same endpoints in Phase 3.
- A UI cannot drift from enforcement, because affordance and enforcement run the same checks.

### Alternatives Considered

- **Duplicate the checks in each UI** — drift risk, and the review-window check would be wrong under a virtual clock.
- **Embed actions in the Application resource** — mixes a per-user view into a shared resource.

---

## DR-016: Browser surfaces implement the workbench ability with Playwright directly

**Status:** Proposed (Phase 2, 28 September 2026)
**Date:** 2026-09-28

### Context

Tasks and questions depend only on the abstract `OperateTheWorkbench` ability (DR-006), so a browser surface must provide the same operations. Rewriting them as surface-specific Serenity/JS web interactions would fork the tasks per surface.

### Decision

`BrowserBackend` implements the workbench operations with Playwright. Commands use role-and-name locators, and reads use `data-value` attributes (DR-007). `BrowseTheWorkbench` wraps it as the ability. Preconditions go through the API. Forced commands go to the API with the browser context's own session cookie (DR-010). UI-only steps use a separate `UseTheScreens` ability. Each member of staff gets a separate browser context with `en-GB` locale and `Europe/London` time.

### Consequences

- The same tasks, questions and step definitions drive core, API and Angular unchanged; the parity gate grep enforces it.
- Serenity/JS reports show task-level activities for the browser surface, not individual clicks. Moving the backend to `@serenity-js/web` interactions is possible later without changing any step.

### Alternatives Considered

- **Surface-specific Serenity/JS web tasks** — richer reports, but a second set of tasks per UI and step definitions that must choose between them.

