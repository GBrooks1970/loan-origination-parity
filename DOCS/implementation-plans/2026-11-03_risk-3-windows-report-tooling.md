---
version: 1
created: 2026-11-03T15:59Z
project: loan-origination-parity
type: implementation-plan
item: "Risk #3"
status: proposed
approved: not yet
delivered: not yet
language: en-GB
---

# Implementation plan: Action 3 — portable parity and report tooling on Windows

**Goal.** Resolve backlog Risk #3 by making the parity gate, measured timings and HTML report generator work on Windows while retaining Linux semantics, scenario identity and the planted-change negative check.

## Evidence gathered before planning

Read-only inspection and bounded probes on 3 November 2026 covered backlog v7, latest handover v1, current tools, package metadata, registry gate, shared template and workflow. No nested AGENTS.md or project contract exists; root AGENTS.md applies and registry gate is `npm run verify`. No dependency install, application suite or report build was run. Only proposed planning documents are written. The handover's zero-risk state is older than backlog Risk #3 and must not override it.

| Finding | Consequence for the plan |
|---|---|
| Local clean main and live remote main both equal `59671e5397589f260136078494d562f6f66bbf23`; no open PRs | Recheck before approved implementation; do not rely on this clone's historically narrow fetch refspec |
| Latest main [CI run 37593097097](https://github.com/GBrooks1970/loan-origination-parity/actions/runs/37593097097) succeeded on that SHA, 7 October | Linux success does not establish Windows portability or a fresh run |
| Direct execution of unmodified `tools/check-parity.mjs` on Windows/Node 24.18.0 fails with ENOENT at `readdirSync`, path beginning `D:\D:\` | Reproduced current root conversion defect, not merely historical backlog evidence |
| `check-parity.mjs:9`, `build-reports.mjs:17`, `report-timings.mjs:9` use file URL `.pathname` | Convert each filesystem URL with `fileURLToPath`; this also decodes spaces and non-ASCII path names correctly |
| Existing saved reports contain 33 core, 85 API, 106 Angular and 106 Next.js pickles; all 330 URIs use backslashes | These are existing artefacts, not newly passed tests; use them as portability fixtures with provenance |
| Read-only selection probe finds zero domain-rules pickles per surface with the existing `includes('features-shared/domain-rules/')`, and 33 each after slash normalisation | The report's negative-check selection is demonstrably wrong on Windows data; ensure it cannot silently miss its tamper target |
| `check-parity.mjs:55,70` and `build-reports.mjs:147,202` assume slash-separated feature URIs | Centralise the feature-relative URI key and use it consistently for grouping, identity and negative-check selection |
| `spawnSync('npx', ['--version'])` gives ENOENT; current report builder uses bare npx | Replace shell-dependent command discovery |
| Installed Serenity package 3.48.0 declares bin `bin/serenity-bdd`; launching it via `process.execPath` with `--version` exits 0 and prints 3.48.0 | Prefer a resolved local CLI and argument array; this probe proves launchability only, not Java/report execution |
| `.nvmrc` pins 24.21.0, but investigative runtime is 24.18.0; declared Node range is `^22.22.3 || ^24.15.0` | Run acceptance with pinned Node; report this probe's actual version honestly |

The report builder deletes/recreates its generated site and invokes Java, so it was deliberately not executed during investigation. No report success or repaired parity result is claimed. Existing report input SHA/provenance should be captured again at implementation time.

### Suggested solutions

| Option | Assessment |
|---|---|
| **Recommended: small shared URI helper, native URL conversion and shell-free CLI** | Addresses all confirmed paths while preserving deterministic scenario identity; no new dependency required |
| Repeat slash replacements in each caller and use Windows-only `shell: true` | Smaller immediate edit but duplicates the identity rule and introduces shell quoting for paths/project titles; less durable |
| Require WSL/Docker for report tooling | Avoids native symptoms but leaves the stated Windows contributor defect unresolved; not recommended |
| Redesign the report pipeline or add a Windows CI matrix immediately | Broader than required; consider a separate coverage enhancement after bounded local proof |

## Steps

1. After approval, recheck main, local changes and backlog, safely refresh the correct remote ref, then create `codex/loan-risk-3-windows-tooling`. Preserve this proposal. Record Risk #3 as in progress with explicit Windows/Linux acceptance criteria; leave unrelated roadmap and accepted risks unchanged.
2. Specify the portable URI contract in tests before changing consumers. Add `tools/report-paths.mjs` exposing a pure feature-relative path function: normalise backslashes, find the `features-shared/` path segment, return the canonical slash-relative key and reject missing/malformed markers with a useful error. Preserve filename case, spaces, scenario names, step text and arguments; do not filesystem-resolve Cucumber URI strings or collapse different feature files into the same key. Cover relative, absolute Windows and POSIX paths actually supported by existing messages.
3. Add `fileURLToPath` in `tools/check-parity.mjs`, `tools/build-reports.mjs` and `tools/report-timings.mjs` for their current root/report URL expressions. Replace all feature-URI splits and the domain-rules selection in the first two scripts with the shared helper. The negative-check selector must target the normalised first folder exactly, not a substring elsewhere in the path.
4. In `tools/build-reports.mjs`, resolve the installed `@serenity-js/serenity-bdd` CLI from its package location using `createRequire`/package metadata and invoke `spawnSync(process.execPath, [cliPath, 'run', ...existingArguments], ...)`. Retain cwd, source/destination/cache/features/project values and argument boundaries. Preserve non-zero failures and report `result.error` meaningfully. No shell, global executable or package download should be required. If package exports prevent metadata lookup, resolve a supported package entry and locate/verify its declared bin; do not silently fall back to network npx.
5. Add `tools/tests/report-tooling.test.mjs` using Node's existing test runner and a `test:tools` script in `package.json`; wire it into the existing `test:unit` path so the current Linux static job runs it without a workflow change. Use temporary fixture roots with spaces and isolated child processes; verify consumer integration as well as the pure helper, including the report builder's tamper-selection branch. Extract only the small data-selection function needed to test that branch without launching Java. Keep tooling fixtures outside real report output.
6. Run the verification matrix below using pinned Node and Java 17+ (CI uses Temurin 21). Capture existing artefacts before regeneration; run the four surfaces and real report pipeline in an isolated checkout or approved output area. Do not recursively remove arbitrary computed paths: verify any generated output/tamper-copy target remains inside the intended workspace or temporary root before deletion. No Docker operation is required; if separately selected for Linux verification, first verify storage against `E:\_DockerData`.
7. Reconcile `docs/backlog.md` only to the extent proved; update relevant Windows bring-up guidance in README and `CHANGELOG.md`. Append an immutable implementation log and walkthrough with actual checks/counts/durations/SHAs. Follow the walkthrough skill's archiving rules when authoring it. Prepare the next numeric handover (currently v2) as Markdown/generated HTML in the separate portfolio support repository, superseding v1's zero-risk claim. Update this plan's Outcome/index after execution without rewriting its approved body.

## Verification

| Check | Required evidence |
|---|---|
| Existing failure baseline | Preserve the unmodified gate's doubled-drive ENOENT and URI-selection probes; do not call an expected failure a repaired gate |
| URI unit fixtures | Windows backslash and POSIX slash representations produce the same feature keys, folder selection and scenario identity; spaces preserved; malformed/missing marker rejected |
| Must-fail regression | Reintroducing the old split/selection into an isolated fixture makes the Windows regression assertion fail; clean mixed-separator input passes |
| Real negative parity check | Tamper exactly one domain-rules step in a temporary report copy; gate exits non-zero with DIFFERS. Clean inputs pass, and missing inputs still fail. A failure solely due to path errors does not count as detection |
| CLI launch contract | Arguments with spaces stay separate; resolved local Node CLI launches on Windows/Linux; child failure/non-zero status propagates. No global npx or shell dependency |
| Windows acceptance | Under pinned Node, `npm run verify`, `npm run report:timings`, `npm run report:html` pass with fresh four-surface results and Java available. Capture actual counts; historical reference is 33/85/106/106 executions and parity folder counts 33/52/21, not a fabricated new result |
| Generated evidence | Four surface reports and evidence index exist; domain rows are present; clean parity PASS and deliberate negative FAIL are backed by actual gate output; timings summary names all four surfaces. Inspect the rendered index and linked report pages |
| Linux regression | Existing full PR CI passes type/unit/oracle, four surfaces, parity/timings and report jobs; exact-main CI after owner merge. Keep deployment gated by existing successful parity/report jobs |

If full local verification is blocked by Python launcher, Java, browser installation, stale fixtures or unrelated failures, record the exact condition and distinguish it from these three script fixes. Do not silently broaden into dependency upgrades or claim complete Windows support from helper tests alone. The existing approximately two-hour backlog effort is an estimate, not measured delivery time.

## Delivery

**Publication authorisation (2026-11-03).** The owner authorised committing, pushing and merging these planning documents through PRs. This authorises documentation publication only; the implementation plan remains proposed and its execution still awaits approval. Earlier statements about no commits or PRs describe the investigation stage.

**Git path casing.** This Windows checkout combines existing tracked `DOCS/decision-register.md` and `docs/backlog.md` in one physical directory. New planning files use `DOCS/implementation-plans/` and `DOCS/templates/` as reported by Git. Preserve those exact paths in publication links, verify links against the Git tree on Linux, and retain existing tracked path casing; no directory normalisation or rename is included.

Proposed plan only; no source, dependencies, backlog, branch or remote state changed during investigation. After approval use the project branch/draft-PR flow; Gary reviews and merges. Handovers use a separate portfolio-root branch/PR. Verify exact-main CI, fast-forward safely, then remove only the merged task branches. The project's unusual remote refspec must be checked during refresh.

**Non-goals:** application/domain changes; scenario-count or step-identity relaxation; report redesign; dependency upgrades; new CI runner matrix; roadmap candidates; changes to browser harness behaviour or deployment policy. Windows CI coverage can be proposed separately if desired.

## Decisions put to the owner

| Decision | Options | Recommended | Owner's answer |
|---|---|---|---|
| Portable fix | Shared URI helper and local CLI / duplicated fixes with shell / WSL-only | Shared helper, fileURLToPath and shell-free local CLI | Awaiting approval |
| CI scope | Existing Linux jobs plus native Windows acceptance / add Windows matrix | Existing jobs plus recorded Windows acceptance; matrix separate | Awaiting approval |
| Unexpected environment failures | Record and propose follow-up / silently expand scope | Record exact blocker and propose separate work | Awaiting approval |
| Publication | Draft project PR and separate support handover / direct main | Draft PRs; owner-controlled merges | Awaiting approval |

## Outcome

Investigation complete; implementation not started. Current root, URI and command-launch failures are reproduced with bounded probes. Candidate fixes still require implementation and full regression evidence.
