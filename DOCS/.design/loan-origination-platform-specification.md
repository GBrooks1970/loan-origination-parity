# Loan Origination Parity — Platform Specification

**Version:** v1.2
**Date:** 2026-09-27
**Status:** Approved — Phase 0 contract accepted by the owner on 27 September 2026
**Supersedes (for Alpha only):** PRJ-01 in `project-specs/potential-project-outlines/nodejs-angular-multi-stack-parity-outlines.md` (V1) and `…-tri-stack-parity-outlines-v2.md` (V2)
**Derived from:** `project-specs/potential-project-outlines/multi-stack-parity-outlines-critique.md` §2.1, §2.4, §5
**Decisions:** [`../decision-register.md`](../decision-register.md) (DR-001 – DR-013, all Accepted)
**API contract:** [`../.architecture/openapi.yaml`](../.architecture/openapi.yaml)

---

## 1. Purpose and scope

A UK retail **unsecured personal loan origination workbench**, used by bank staff to key, evaluate, approve and decline applications. One domain engine sits behind four surfaces: an in-memory core, a Node.js REST API, an Angular SPA and a Next.js App Router application. One Serenity/JS Screenplay harness drives a single canonical Gherkin store across all of them.

The showcase proves two things:

1. **Surface portability.** The same business specification passes unchanged on a headless API, a client-rendered SPA and a server-rendered hybrid.
2. **Server-side enforcement.** Authority limits and maker–checker rules hold even when the user interface is bypassed. This is the RBAC capability folded in from candidate Delta (DR-003).

### In scope

- Automated decision rules R01–R04 (§5), rule-set version `2026.10`
- Application state machine including referral, withdrawal, expiry and human review (§6)
- Staff roles, approval authority limits, maker–checker (§7)
- Rule-level audit trail and authorisation-denial audit (§8)
- Customer-facing decline notice content (§9)
- Test-control API for reset, partitioning, clock and credit-reference fixtures (§11)

### Out of scope

- Secured lending, LTV, joint applications, affordability stress tests on variable rates
- Calculating the repayment. The monthly repayment is supplied by the product quote and is not validated against amount, term or APR.
- Real identity provider, passwords, MFA (DR-012). The `auth-separation*` projects cover identity.
- Policy engine features: combining algorithms, policy authoring, break-glass, policy versioning beyond a rule-set label
- Hash-chained or signed audit ledger
- Python and C# harnesses (DR-013)
- Performance and load claims

---

## 2. Regulatory model (UK)

The rules are **modelled on** UK consumer credit obligations, simplified for a test-automation showcase. They are not a compliance implementation and not legal advice (DR-002).

| Obligation (modelled on) | How it appears in this system |
| :--- | :--- |
| FCA CONC 5.2A — creditworthiness and affordability assessment | Rules R03 (debt service ratio) and R04 (residual income) |
| FCA Consumer Duty (PRIN 2A) — consumer understanding | Decline notices use plain-language reasons; internal rule IDs and thresholds never reach the customer (§9) |
| Consumer Credit Act 1974 s.157 — disclosure of credit reference agency | A decline that relied on credit reference data names the agency (§9) |
| UK GDPR Article 22 — right to human intervention in automated decisions | An automated decline can be put to human review within 30 days (§6.3) |
| Senior Managers & Certification Regime-style delegated authority | Role-based approval limits and maker–checker (§7) |

Currency is GBP. Business dates are evaluated in the `Europe/London` time zone. Money is written in Gherkin as bare numbers (portfolio Gherkin style guide).

---

## 3. Topology

```
                         features-shared/  (one Gherkin store)
                                   │
                  Serenity/JS Screenplay harness (TypeScript)
     ┌──────────────┬──────────────┼──────────────────┬─────────────────────┐
 CallDomainCore   CallAnApi   BrowseTheWebWithPlaywright  BrowseTheWebWithPlaywright
     │              │               │ (Angular)                │ (Next.js)
     ▼              ▼               ▼                          ▼
 packages/     demoapp001-      demoapp002-angular-spa    demoapp003-nextjs-bff
 domain-core   node-service     (browser → Node API)      (browser → Next server
 (in-memory)   (REST, :8000)    served statically :4200    → Node API), :3000
     ▲              │                   │                          │
     └──────────────┴──── imports ──────┴──── HTTP ────────────────┘
```

- `packages/domain-core` holds the rules, state machine, authorisation policy and audit model. It has no I/O. Time, credit reference data and persistence enter through ports (`Clock`, `CreditBureauGateway`, `ApplicationRepository`, `AuditLog`).
- `demoapp001-node-service` is the **single state authority** and the only process that imports `domain-core` at runtime (DR-004).
- The Angular SPA calls the Node API from the browser.
- The Next.js app is a **backend-for-frontend**. Server Components read from the Node API, and Server Actions write to it. It never re-implements rules.

---

## 4. Domain model

### 4.1 Application

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | string | `APP-` + 6 digits, allocated per namespace in submission order from `APP-000001` |
| `applicant.dateOfBirth` | ISO date | |
| `applicant.creditReferenceScore` | integer 0–999 | Supplied by `CreditBureauGateway`, never keyed by staff |
| `applicant.netMonthlyIncome` | money | Verified figure |
| `applicant.monthlyCreditCommitments` | money | Existing credit repayments |
| `applicant.essentialMonthlyExpenditure` | money | Housing, utilities, council tax, food, transport |
| `amount` | money | 1000.00 – 25000.00 inclusive |
| `termMonths` | integer | 12 – 60 inclusive |
| `monthlyRepayment` | money | From the product quote |
| `status` | enum | §6 |
| `decisionType` | `AUTOMATED` \| `MANUAL` \| null | Who made the last accept/decline decision |
| `recommendation` | `ACCEPT` \| `REFER` \| `DECLINE` | Output of §5 |
| `createdBy`, `decidedBy` | staff username | |
| `submittedAt`, `decidedAt` | ISO instant (UTC) | |
| `ruleSetVersion` | string | `2026.10` |

### 4.2 Money and arithmetic (DR-008)

- All money uses decimal arithmetic. IEEE 754 floats are forbidden in `domain-core`.
- Money crosses every wire as a **string** with exactly two decimal places (`"5000.00"`).
- Derived percentages are rounded **half-even** to two decimal places *before* any threshold comparison.

### 4.3 Validation (before evaluation)

Validation runs after §7.2 checks 1–2 (authentication and role). Invalid requests are rejected with HTTP 422; no application is created and no audit event is written.

| Condition | Error code |
| :--- | :--- |
| `amount` < 1000.00 or > 25000.00 | `AMOUNT_OUT_OF_RANGE` |
| `termMonths` < 12 or > 60 | `TERM_OUT_OF_RANGE` |
| Any money field negative, or with more than 2 decimal places | `INVALID_MONEY` |
| `netMonthlyIncome` = 0.00 | `INVALID_MONEY` |
| Manual decline with a blank reason (checked after §7.2 checks 1–7) | `REASON_REQUIRED` |

---

## 5. Decision rules (rule set `2026.10`)

Every rule is evaluated for every application, in rule order, even after an earlier failure. Each result is `PASS`, `REFER`, `FAIL` or `NOT_APPLICABLE`.

| Rule | Name | Observed value | Result |
| :--- | :--- | :--- | :--- |
| `R01_AGE` | Minimum age | Age in whole years on the business date (Europe/London) | `PASS` if age ≥ 18, else `FAIL` |
| `R02_CREDIT_BAND` | Credit band | Band from score (§5.1) | `FAIL` if band D, else `PASS` |
| `R03_DSR` | Debt service ratio | DSR (§5.2) | Band thresholds (§5.3); `NOT_APPLICABLE` for band D |
| `R04_RESIDUAL_INCOME` | Residual income | income − commitments − repayment − essential expenditure | `PASS` if ≥ 300.00, else `FAIL` |

**Age rule detail.** A 29 February birthday is treated as 1 March in non-leap years. This is a specification decision for determinism, recorded in the spec rather than asserted as law.

### 5.1 Credit band

| Score | Band |
| :--- | :--- |
| 881 – 999 | A |
| 721 – 880 | B |
| 561 – 720 | C |
| 0 – 560 | D |

### 5.2 Debt service ratio

```latex
\mathrm{DSR} = \operatorname{round}_{\text{half-even},\,2}\left(\frac{\text{commitments} + \text{repayment}}{\text{net income}} \times 100\right)
```

### 5.3 DSR thresholds by band

| Band | `PASS` when DSR ≤ | `REFER` when DSR ≤ | `FAIL` when DSR > |
| :--- | :--- | :--- | :--- |
| A | 40.00 | 45.00 | 45.00 |
| B | 35.00 | 40.00 | 40.00 |
| C | 30.00 | 35.00 | 35.00 |
| D | — (`NOT_APPLICABLE`; DSR still computed and recorded) | — | — |

### 5.4 Combination

- Recommendation = worst result: any `FAIL` → `DECLINE`; else any `REFER` → `REFER`; else `ACCEPT`.
- **Decline reasons** = the reason codes of `FAIL` rules only, in rule order. `REFER` results are never decline reasons.

| Rule | Decline reason code |
| :--- | :--- |
| `R01_AGE` | `ELIGIBILITY_AGE` |
| `R02_CREDIT_BAND` | `CREDIT_HISTORY` |
| `R03_DSR` | `AFFORDABILITY_DSR` |
| `R04_RESIDUAL_INCOME` | `AFFORDABILITY_RESIDUAL` |

---

## 6. State machine

### 6.1 States

| State | Terminal | Meaning |
| :--- | :--- | :--- |
| `AWAITING_APPROVAL` | No | Automated `ACCEPT`; needs a second person to approve |
| `REFERRED` | No | Automated `REFER`, or a human review was requested; needs a senior underwriter |
| `APPROVED` | Yes | |
| `DECLINED` | Yes* | Automated or manual. *An automated decline can move to `REFERRED` once, via human review |
| `WITHDRAWN` | Yes | Withdrawn by the member of staff who created it |
| `EXPIRED` | Yes | No decision within 30 days of submission |

### 6.2 Transitions

| From | Command | Guard (in addition to §7) | To | `decisionType` |
| :--- | :--- | :--- | :--- | :--- |
| — | submit | Validation (§4.3) | `AWAITING_APPROVAL` / `REFERRED` / `DECLINED` by recommendation | `AUTOMATED` if declined |
| `AWAITING_APPROVAL` | approve | | `APPROVED` | `MANUAL` |
| `AWAITING_APPROVAL` | decline | Reason text required | `DECLINED` | `MANUAL` |
| `REFERRED` | approve | Senior underwriter only | `APPROVED` | `MANUAL` |
| `REFERRED` | decline | Senior underwriter only; reason text required | `DECLINED` | `MANUAL` |
| `AWAITING_APPROVAL`, `REFERRED` | withdraw | Creator only | `WITHDRAWN` | unchanged |
| `DECLINED` (`AUTOMATED`, no prior review) | request human review | Within 30 days of `decidedAt` | `REFERRED` | cleared |
| `AWAITING_APPROVAL`, `REFERRED` | (time) | `now` > `submittedAt` + 30 days | `EXPIRED` | unchanged |

### 6.3 Time rules

- **Expiry** is strict: an application submitted at `2026-10-01T09:00:00Z` is live at `2026-10-31T09:00:00Z` and expired at `2026-10-31T09:00:01Z`. Expiry is applied lazily. Any read or command on the application first applies it, so behaviour is deterministic under the virtual clock and needs no background job.
- **Human review window** is inclusive: a request at exactly `decidedAt` + 30 days is accepted; one second later it is refused with `REVIEW_WINDOW_CLOSED`.

---

## 7. Roles and authorisation

### 7.1 Roles

| Role | Submit | Approve / decline `AWAITING_APPROVAL` up to | Decide `REFERRED` | Withdraw | Request human review | Read audit trail |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| `LOAN_OFFICER` | ✓ | 10000.00 | ✗ | Own only | ✓ | ✓ |
| `UNDERWRITER` | ✓ | 20000.00 | ✗ | Own only | ✓ | ✓ |
| `SENIOR_UNDERWRITER` | ✓ | 25000.00 | ✓ (up to 25000.00) | Own only | ✓ | ✓ |
| `AUDITOR` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

Limits are inclusive: a loan officer may approve exactly 10000.00.

### 7.2 Check order and denial codes

Checks run in this fixed order. The first failure is returned, so each scenario's expected code is deterministic.

| # | Check | Denial code | HTTP |
| :--- | :--- | :--- | :--- |
| 0 | (Lazy expiry applied) | — | — |
| 1 | Caller authenticated | `UNAUTHENTICATED` | 401 |
| 2 | Role permits the command at all | `ROLE_NOT_PERMITTED` | 403 |
| 3 | Current state permits the command | `INVALID_STATE` | 409 |
| 4 | Withdraw: caller is the creator | `NOT_APPLICATION_OWNER` | 403 |
| 5 | Approve / decline: caller is not the creator (maker–checker) | `SELF_APPROVAL` | 403 |
| 6 | Decide `REFERRED`: caller is a senior underwriter | `REFERRAL_AUTHORITY` | 403 |
| 7 | Approve / decline: amount ≤ caller's limit | `LIMIT_EXCEEDED` | 403 |
| 8 | Human review: decline was automated | `REVIEW_NOT_AVAILABLE` | 409 |
| 9 | Human review: within window | `REVIEW_WINDOW_CLOSED` | 409 |

Every denial at checks 2–9 writes an `AUTHORISATION_DENIED` audit event and leaves the application unchanged. A refused submission is audited with a null application ID. Check 1 writes nothing because there is no identity to record.

### 7.3 Enforcement location

Enforcement lives **only** in `domain-core`, executed by the Node service. User interfaces hide actions the user cannot take, which is a usability affordance, never enforcement. The `@security` scenarios prove that the Node service refuses commands that the UI would never have offered (DR-010).

---

## 8. Audit trail

Events are append-only per namespace, with a monotonically increasing `sequence`.

| Event | Written when | Payload |
| :--- | :--- | :--- |
| `APPLICATION_SUBMITTED` | Submit succeeds | inputs, `ruleSetVersion` |
| `RULE_EVALUATED` | Once per rule per evaluation (4 per submission) | `rule`, `result`, `observed`, `threshold` |
| `STATUS_CHANGED` | Every transition, including lazy expiry | `from`, `to`, `actor` (`system` for expiry) |
| `AUTHORISATION_DENIED` | §7.2 checks 2–9 | `command`, `actor`, `code` (application ID null for a refused submission) |
| `HUMAN_REVIEW_REQUESTED` | Review accepted | `actor` |
| `DECLINE_NOTICE_ISSUED` | Any transition to `DECLINED` | `reasons`, `creditReferenceAgencyDisclosed` |

`RULE_EVALUATED` `observed` / `threshold` formats:

| Rule | observed | threshold |
| :--- | :--- | :--- |
| `R01_AGE` | whole years, e.g. `35` | `18` |
| `R02_CREDIT_BAND` | band letter | `C` (lowest acceptable band) |
| `R03_DSR` | two-decimal percentage | band's `PASS` limit, e.g. `35.00`; `none` when `NOT_APPLICABLE` |
| `R04_RESIDUAL_INCOME` | money | `300.00` |

---

## 9. Decline notice

Issued to the customer (via staff) for every `DECLINED` application.

- Lists one plain-language reason per decline reason code, in rule order:

| Code | Customer text |
| :--- | :--- |
| `ELIGIBILITY_AGE` | You do not meet our minimum age requirement. |
| `CREDIT_HISTORY` | Information from a credit reference agency about your credit history. |
| `AFFORDABILITY_DSR` | Your existing and proposed credit repayments are too high compared with your income. |
| `AFFORDABILITY_RESIDUAL` | The income you would have left after essential spending and repayments is too low. |
| `UNDERWRITER_DECISION` | An underwriter reviewed your application and was unable to approve it. |

- When `CREDIT_HISTORY` is a reason, the notice names the agency: **Fixture Credit Reference Agency Ltd**. It sets `creditReferenceAgencyDisclosed: true`; otherwise false.
- An automated decline states that the customer may ask for a person to review the decision within 30 days.
- The notice **never** contains rule identifiers (`R0n_…`), thresholds, DSR values or credit scores.
- Manual declines carry the single reason `UNDERWRITER_DECISION`. The underwriter's free-text reason stays internal (audit only).

---

## 10. Surfaces

### 10.1 Surface reach by feature folder (DR-006)

| Folder | Domain core | API | Angular | Next.js |
| :--- | :---: | :---: | :---: | :---: |
| `features-shared/domain-rules/` | ✓ | ✓ | ✓ | ✓ |
| `features-shared/workflows/` | — | ✓ | ✓ | ✓ |
| `features-shared/ui-only/` | — | — | ✓ | ✓ |

The parity gate compares passed-scenario counts and step text per folder across the surfaces that folder targets.

### 10.2 UI contract (both UIs, identical)

Both UIs implement the **same underwriter workbench** for the same staff personas. There is no customer-facing portal (critique §2.1, refinement 1).

| Page | Route | Purpose |
| :--- | :--- | :--- |
| Sign in (test mode only) | `/sign-in` | Choose a seeded staff member (DR-012) |
| Queue | `/applications` | List with status filter |
| New application | `/applications/new` | Key and submit |
| Application detail | `/applications/:id` | Decision, rule results, actions |
| Audit trail | `/applications/:id/audit` | Events table |
| Decline notice | `/applications/:id/decline-notice` | Customer-facing text |

Locator contract (DR-007):

- Interactive controls are located by ARIA role and accessible name only. Button names are fixed: `Submit application`, `Approve`, `Decline`, `Withdraw`, `Request human review`.
- Read-only values carry `data-testid` plus a canonical `data-value`, e.g. `<span data-testid="dsr" data-value="35.00">35.00%</span>`. Parity assertions read `data-value`, never formatted text.
- A hidden action renders a `data-testid="action-unavailable"` element with `data-action` and `data-reason` (a §7.2 code), so affordance scenarios assert *why* an action is absent.
- Formatting is asserted only in `ui-only/value-formatting.feature`, in `en-GB` and `Europe/London`.

### 10.3 Next.js specifics (DR-004, DR-010)

- Every route that reads application data is dynamic (`await connection()` or a literal `export const dynamic = 'force-dynamic'`). `next build` must succeed with the Node service offline.
- Server Actions delegate to the Node API and then call `revalidatePath` for the affected routes.
- Server Actions are exercised only through the browser. The forced-command steps submit an action form captured at run time from a page rendered for a staff member who is offered it (DR-010).

---

## 11. Test-control API and determinism (DR-005)

Compiled into the Node service only when `APP_MODE=test`. Every call requires `X-Test-Control-Token`.

| Endpoint | Effect |
| :--- | :--- |
| `POST /__test__/namespaces/{ns}/reset` | Deletes all applications, audit events, staff, clock and bureau fixtures in `{ns}` |
| `PUT /__test__/namespaces/{ns}/staff` | Replaces the staff directory: `[{username, role}]` |
| `PUT /__test__/namespaces/{ns}/clock` | Sets the virtual clock to an ISO instant. The clock never advances on its own. |
| `PUT /__test__/namespaces/{ns}/bureau/{applicantRef}` | Sets the score the fixture credit reference agency returns |

**Namespacing.** Every request carries `X-Test-Namespace`. The harness allocates one namespace per scenario, so parallel workers never share state and there is no global reset. Propagation:

- API ability: sets the header directly.
- Angular: the harness sets a `test-namespace` cookie. An HTTP interceptor present only in test builds copies it to the header.
- Next.js: the server reads the same cookie and forwards the header on every call to the Node API.

**Isolation per scenario:** a new namespace, a new browser context (cookies, storage, Next.js Router Cache), and a fixed Playwright `locale: 'en-GB'` and `timezoneId: 'Europe/London'`.

**Target:** namespace set-up (staff + clock + bureau) completes in under 200 ms per scenario, measured in Phase 1 and recorded. No figure is claimed until measured.

---

## 12. Step glossary (reuse contract)

One phrasing per intent. A new step needs a glossary entry first. A near-duplicate step is a defect (portfolio Gherkin style guide). `{actor}` is a name from the staff directory. The Surface column says how each ability realises the step; the Gherkin never does.

**Two rules that make UI parity possible:**

- **Refusals are always forced.** Any scenario that expects a refusal drives the command with `{actor} forces the "{command}" command on the application`, because a correct UI would not offer the control. What the UI offers is covered separately in `ui-only/role-based-affordances.feature`.
- **Preconditions go through the API** on every surface (style guide), including browser surfaces.

### Arrange

| Step | Domain core | API | Angular / Next.js |
| :--- | :--- | :--- | :--- |
| `the current time is "{instant}"` (also used as a When) | `Clock` port | test-control clock | test-control clock |
| `the following staff members:` | in-memory directory | test-control staff | test-control staff |
| `an applicant with:` (vertical table) | build input; bureau fixture | bureau fixture; hold body | bureau fixture; hold values |
| `{actor} has submitted an application for {amount} that is awaiting approval` | §13 accepted fixture | same, via API | same, via API |
| `{actor} has submitted an application that was referred` / `…declined` | §13 fixtures | via API | via API |
| `{actor} has approved the application` / `has declined the application with the reason "{text}"` / `has requested a human review of the application` | service call | API | via API |
| `{actor}'s role is changed to "{role}"` | directory | test-control staff | test-control staff |

### Act

| Step | Domain core | API | Angular / Next.js |
| :--- | :--- | :--- | :--- |
| `{actor} submits an application for {amount} over {n} months with a monthly repayment of {money}` | `ApplicationService.submit` | `POST /applications` | New application page |
| `… using only the keyboard` (`ui-only/` only) | — | — | keyboard-only Task |
| `{actor} approves the application` / `declines the application with the reason "{text}"` / `withdraws the application` / `requests a human review of the application` | service call | API call | the named control |
| `{actor} forces the "{command}" command on the application` — commands `approve`, `decline`, `withdraw`, `request human review` | — | API call | See DR-010: Angular calls the API with the SPA's session; Next.js submits the action form captured at run time into the actor's browser context |
| `a visitor who is not signed in forces the "{command}" command on the application` | — | API call, no session | as above, no session cookie |
| `{actor} views the application` / `views the application queue` / `views the {page} page` (`ui-only/`) | — | — | navigation |

### Assert

| Step | Reads |
| :--- | :--- |
| `the recommendation is "{value}"` · `the credit band is "{band}"` · `the debt service ratio is {pct} percent` · `the application status is "{status}"` · `the decision type is "{type}"` · `the evaluation used rule set "{version}"` | Result object / response JSON / `data-value` |
| `the decline reasons are "{csv}"` (`none` = empty list) | same |
| `the application was created by {actor}` · `…decided by {actor}` | same |
| `the submission is refused with reason "{code}"` · `the command is refused with reason "{code}"` | error / problem+json `code` / on-page `data-reason` |
| `no application has been created` | repository / `GET /applications` / queue |
| `the audit trail records the rule results:` (rule, result, observed, threshold) | audit port / `GET …/audit` / audit page |
| `the audit trail records a denied "{command}" by {actor} with reason "{code}"` · `…a status change from "{s1}" to "{s2}" by "{actor}"` · `…a human review request by {actor}` | same |
| `the decline notice gives the reasons:` · `names the credit reference agency "{name}"` · `does not name a credit reference agency` · `offers a human review` · `does not offer a human review` · `does not contain "{text}"` | notice object / `GET …/decline-notice` / notice page |
| `the "{action}" action is offered` · `is unavailable because "{code}"` (`ui-only/`) | `action-unavailable` marker |
| `the {field} is displayed as "{text}"` · `the page has no accessibility violations of serious or critical impact` · `no errors are written to the browser console` (`ui-only/`) | formatted text / axe-core / console |

## 13. Fixtures

| Fixture | Values | Recommendation |
| :--- | :--- | :--- |
| **Standard applicant** | DOB 1991-03-15; score 800 (B); income 3000.00; commitments 450.00; essential 1200.00; repayment 300.00 | `ACCEPT` — DSR 25.00, residual 1050.00 |
| **Accepted application for {amount}** (harness convenience) | DOB 1991-03-15; score 800; income 5000.00; commitments 500.00; essential 1500.00; term 60; repayment = amount × 0.024, half-even to 2 dp | `ACCEPT` for every amount 1000.00 – 25000.00 (max DSR 22.00) |
| **Referred application** | Standard DOB; score 650 (C); income 4000.00; commitments 800.00; essential 1500.00; amount 10000.00; term 36; repayment 600.00 | `REFER` — DSR 35.00 vs C limit 30.00 |
| **Declined application** | Standard DOB; score 500 (D); otherwise as referred | `DECLINE` — `CREDIT_HISTORY` |

Staff used across features:

| Name | Role |
| :--- | :--- |
| Olivia | `LOAN_OFFICER` (usual maker) |
| Liam | `LOAN_OFFICER` |
| Uma | `UNDERWRITER` |
| Sam | `SENIOR_UNDERWRITER` |
| Aled | `AUDITOR` |

Every expected value in `features-shared/` was computed with [`../../tools/check-expected-values.py`](../../tools/check-expected-values.py), an independent decimal reference model that parses the feature files and recomputes every rule outcome. It is Phase 0 evidence, not SUT code. Workflow scenarios built on fixtures are verified against the state and authorisation tables in §6–7 by review, not by the oracle.

---

## 14. Traceability

| Spec section | Features |
| :--- | :--- |
| §4.3 validation | `workflows/application-submission` |
| §5 R01 | `domain-rules/age-eligibility`, `rule-combination` |
| §5.1 bands | `domain-rules/credit-band-mapping`, `dsr-thresholds-by-band` |
| §5.2–5.3 DSR | `domain-rules/debt-service-ratio`, `dsr-thresholds-by-band`, `dsr-rounding` |
| §5 R04 | `domain-rules/residual-income` |
| §5.4 combination | `domain-rules/rule-combination` |
| §6 states | `workflows/application-submission`, `referral-handling`, `withdrawal-and-expiry`, `human-review-request` |
| §7 authorisation | `workflows/approval-authority-limits`, `maker-checker`, `referral-handling`, `authorisation-enforcement`; `ui-only/role-based-affordances` |
| §8 audit | `domain-rules/audit-rule-trace`; denial steps across `workflows/` |
| §9 notice | `workflows/decline-notice` |
| §10.2 UI contract | `ui-only/*` |

---

## 15. Phase 0 exit criteria

- [x] Every expected value computed by the reference oracle (§13)
- [x] `tools/check-expected-values.py` passes (99 values across 40 scenarios and the §13 fixtures on 26 September 2026)
- [x] All 19 feature files parse with the official Gherkin parser: 103 expanded scenarios (domain-rules 33, workflows 49, ui-only 21)
- [x] No step in `domain-rules/` or `workflows/` names or implies a single surface
- [x] Owner review of rules, limits and state machine (accepted 27 September 2026, including the illustrative values in §5 and §7 and the §7.2 check order)
- [x] DR-001 – DR-013 moved from `Proposed` to `Accepted` (27 September 2026)
- [x] §16 questions resolved

**Phase 0 is complete.** Carried into Phase 1: resolve framework versions and record them in DR-009 on the day Phase 1 starts.

## 16. Resolved questions

### Amendments in v1.2 (Phase 1, 27 September 2026)

- `REASON_REQUIRED` (422) added for a blank manual-decline reason. §6.2 already required a reason but did not name the refusal.
- The HTTP layer returns `400 INVALID_REQUEST` for a malformed body or a missing test-mode namespace, `404 NOT_FOUND` for an unknown application or route, and `500 INTERNAL_ERROR`. OpenAPI 1.1.0 declares all three, plus `GET /health`.

### Open question raised in Phase 1

- **Expiry after a human review.** §6.3 measures expiry from `submittedAt`, so an application reopened by a human review late in the window (for example on day 30) expires almost immediately. The implementation follows the spec as written. The owner should decide whether a review restarts the 30-day window.

### Phase 0 questions

Both resolved by the owner on 27 September 2026, keeping the behaviour this specification already describes.

| Question | Resolution | Reason |
| :--- | :--- | :--- |
| Should `UNDERWRITER` also decide referred applications up to a lower limit? | **No.** Referred applications are decided by `SENIOR_UNDERWRITER` only, at any amount up to 25000.00. | Keeps referral authority distinct from amount limits, so `REFERRAL_AUTHORITY` and `LIMIT_EXCEEDED` each prove one thing. |
| Who may read an application's audit trail? | **All staff roles**, including the maker. `AUDITOR` remains the only read-only role. | Keeps audit assertions usable through every persona on the browser surfaces. Tighter segregation can be added later as a `ui-only/` affordance scenario. |
