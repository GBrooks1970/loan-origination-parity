# Walkthrough: Phase 3 — Next.js Backend-for-Frontend

**Date:** 28 September 2026
**Branch:** `phase-3/nextjs-bff` (base `main` @ `d1916eb`)
**Owner decisions (28 September 2026):** accept DR-014, DR-015 and DR-016; go ahead with Phase 3; plain CSS. The optional MSW component-state tier (DR-011) was not requested and is not built.

## 1. What was done

| Commit | Change |
| :--- | :--- |
| `4d01025` | DR-014 – DR-016 marked Accepted. DR-014 now says how it applies to Next.js: no separate proxy, and one test-mode route for sign-in. |
| `22c59ae` | `demo-apps/demoapp003-nextjs-bff`: the six workbench pages as Server Components, Server Actions for commands, fixture sign-in in test mode |
| `ff79294` | Harness Next.js surface, forced commands by captured form, runner, four-surface parity gate |
| (this commit) | CI job, DR-017 and DR-018 (Proposed), spec v1.5, DR-009 versions, README, this walkthrough |

**The app.**
- **Rendering.** Next.js 16.3.6 and React 19.3.0 (App Router, Turbopack production build, no experimental flags).
- **Data.** Pages read the Node API on the server. The browser never calls it (DR-004).
- **Markup.** Pages render the same accessible names and `data-value` carriers as Angular (DR-007), and use the same stylesheet plus three layout rules for the command forms.
- **Dynamic routes.** Every data route awaits `connection()`. `next build` succeeds with the Node service offline, and the route table shows every data route as dynamic (`ƒ`).
- **Commands.** Each Server Action calls the Node API, calls `revalidatePath('/applications', 'layout')`, then redirects to `?done=<command>` or `?refused=<code>` (DR-017). Without JavaScript the action answers `303`.
- **Client-side code.** The only client component is the Decline control, which reveals a server-rendered, hidden reason form.
- **Test mode.** `LOP_TEST_MODE=1` is read at run time. It enables the fixture sign-in page, `POST /api/v1/session` and namespace forwarding.

**The harness.**
- **Command outcomes.** `BrowserBackend` takes `rendering: 'client' | 'server'`. On Next.js a command's outcome is the redirect target; on Angular it stays the API response.
- **Forced commands (DR-010 as realised by DR-018).**
  1. Once per run, a donor namespace renders each command form for a member of staff who is offered it.
  2. The harness reads every named field from the DOM, including React's `$ACTION_ID_…`.
  3. The forcing actor's own browser context posts the form without JavaScript against the target application.
  4. The harness reads the refusal code from the `303` Location.
- **Unchanged.** Step definitions, tasks and questions did not change. The parity gate now also rejects step definitions that mention `angular` or `nextjs`.

## 2. Evidence

After a clean `npm ci`, with all build output deleted, `npm run verify` exited 0 in 290 s:

```
ℹ tests 23  ℹ pass 23  ℹ fail 0                 (domain-core)
ℹ tests 4   ℹ pass 4   ℹ fail 0                 (Node service contract)
Checked 99 expected values across 40 scenarios and the §13 fixtures.
Scenarios:  33   Total time: 4s 366ms            (core)
Scenarios:  85   Total time: 14s 238ms           (API)
Scenarios:  106  Total time: 1m 47s 386ms        (Angular)
Scenarios:  106  Total time: 1m 52s 520ms        (Next.js)
Per-scenario set-up (api): p50 6.41 ms, p95 9.66 ms, max 65.11 ms over 85 scenarios
Per-scenario set-up (angular): p50 5.76 ms, p95 10.56 ms, max 42.13 ms over 106 scenarios
Per-scenario set-up (nextjs): p50 6.09 ms, p95 10.4 ms, max 51.28 ms over 106 scenarios
domain-rules   core     33 passed /  33 run / 33 in Gherkin
domain-rules   api      33 passed /  33 run / 33 in Gherkin
domain-rules   angular  33 passed /  33 run / 33 in Gherkin
domain-rules   nextjs   33 passed /  33 run / 33 in Gherkin
workflows      api      52 passed /  52 run / 52 in Gherkin
workflows      angular  52 passed /  52 run / 52 in Gherkin
workflows      nextjs   52 passed /  52 run / 52 in Gherkin
ui-only        angular  21 passed /  21 run / 21 in Gherkin
ui-only        nextjs   21 passed /  21 run / 21 in Gherkin
PARITY PASS
```

After the runner change in `ff79294` (see section 3, item 3), `npm run test:nextjs` then `npm run check:parity` exited 0 in 117 s. That run had 106 scenarios in 1 m 46 s, with per-scenario set-up p50 5.72 ms and p95 9.51 ms, and PARITY PASS. No Node service or Next.js server was left listening afterwards.

**Negative check.** I planted a Next.js-only UI bug: the ratio's `data-value` bound to the credit band. Running `node tools/run-ui-suite.mjs nextjs -- --name "ratio of"` gave 8 of 8 failures and exit 1:
- Debt service ratio: 5 failed.
- Debt service ratio rounding: 3 failed.

The messages were exact, for example `Expected the debt service ratio to equal "35.00"`. The file was restored from a copy afterwards. A first attempt with `--name "Debt service ratio"` ran 0 scenarios, because that is a feature title, not a scenario name. It is not counted as a check.

**Forced path reaches the server as the actor.** The four `Server-side authorisation enforcement` outlines on Next.js assert that the audit trail records a denied command by Aled with reason `ROLE_NOT_PERMITTED`. That record is written by the Node service only when Aled's own session arrives through the replayed Server Action.

## 3. Defects found and fixed

1. **Post-submit wait never matched on Next.js.** After a submit, the harness waited for `**/applications/<id>`, but the Next.js URL carries `?done=submit`. Every UI submit timed out at 30 s. The wait now matches on pathname only, which suits both surfaces.
2. **Decline form had nothing to capture.** The reason form was created on click, on the client. React emits the `$ACTION_ID_…` field only on server-rendered forms, so capture failed with 'The "Confirm decline" form carries no Server Action reference'. That failure took out 19 scenarios, because the capture runs once per run. The form is now server-rendered and hidden until "Decline" is pressed.
3. **Leaked Next.js server.** Starting Next.js with `npm run start` left a `next-server` running after the suite stopped: PID 15690, found after the clean verify. The runner now spawns `next/dist/bin/next start` directly. A re-run confirmed no server was left.
4. **Wrong feature filter.** My first focused run passed a feature path through `--`, but Cucumber still ran the profile's full set of paths, and the 400 s timeout stopped the servers mid-run. Focused runs now use `--name`.

## 4. Notes and limits

- DR-017 and DR-018 are **Proposed**. DR-018 refines how DR-010 is carried out: forms are captured in a donor namespace rather than on the target application, because several refusal scenarios force commands that nobody is offered on the target.
- A refused submission returns an empty form, because typed values are not echoed back (DR-017 consequence).
- Locally, Playwright used the environment's Chromium 141 via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. CI installs Playwright's own Chromium.
- CI adds a Next.js step, and the job timeout rose from 25 to 30 minutes.
