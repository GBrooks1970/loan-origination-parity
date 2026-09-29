# Changelog

All notable changes to Loan Origination Parity will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The project has no tagged releases, so every change so far sits under [Unreleased]. Entries were backfilled from the merged pull requests at portfolio onboarding (29 September 2026), newest first.

---

## [Unreleased]

### Added

- Added Serenity BDD HTML reports: the harness now writes Serenity/JS JSON per surface, `npm run report:html` (`tools/build-reports.mjs`) builds one report per surface plus an index page, and CI publishes them to GitHub Pages from `main` when the parity gate and report build both pass.
- Added `docs/backlog.md` (version 1) and this changelog as part of portfolio onboarding.
- Added the Phase 4 stability evidence: raw data for 10 manually dispatched CI runs, all green on the first attempt, in `docs/evidence/2026-09-28_phase-4-stability-runs.json`. Also added the median timings to the README and the Phase 4 walkthrough (#8).
- Added step-text parity to the parity gate. It now compares feature file, scenario name, step text and step arguments per folder, not only counts (#7).
- Added a timings reporter (`npm run report:timings`) that writes suite and scenario p50/p95/max and harness set-up times to the job summary and `timings-summary.json` (#7).
- Added a parallel CI matrix: static checks, one job per surface (core, API, Angular, Next.js), and a fan-in parity job; `workflow_dispatch` is enabled (#7).
- Added the Next.js 16 backend-for-frontend (`demo-apps/demoapp003-nextjs-bff`), the fourth surface, with Server Components and Server Actions using post/redirect/get (#5).
- Added the Next.js surface to the Serenity/JS harness, with forced commands that replay captured Server Action forms, and extended the parity gate to four surfaces (#5).
- Added decision records DR-017 (Next.js post/redirect/get) and DR-018 (forced commands through captured forms) (#5); both were accepted in #6.
- Added the Angular 22 workbench SPA (`demo-apps/demoapp002-angular-spa`) and the Angular surface of the harness, running the domain-rules, workflows and ui-only folders (#4).
- Added the MIT licence (#3).
- Added the headless system under test: the `@lop/domain-core` engine, the Node.js/Express service with its test-control API, and the core and API surfaces of the Serenity/JS Screenplay harness, with the first parity gate (#1).
- Added the accepted Phase 0 pack: specification, OpenAPI contract, Gherkin feature store, expected-value oracle check (`tools/check-expected-values.py`) and decision register (initial commit).

### Changed

- Changed the CI workflow's GitHub Actions from Node 20 majors to their first Node 24 majors (`checkout@v5`, `setup-node@v5`, `setup-python@v6`, `upload-artifact@v6`, `download-artifact@v7`), which removes the Node 20 deprecation warning; closes backlog Risk #1.
- Changed the application expiry rule so that a human review restarts the 30-day window: applications carry `reopenedAt`, and expiry runs from it when set (spec v1.3, OpenAPI 1.2.0) (#2).
- Changed the status of decisions DR-014 to DR-016 (#5) and DR-017 to DR-018 (#6) from Proposed to Accepted.

### Fixed

- Fixed an intermittent harness race on the browser surfaces. A refusal that arrived before the triggering click finished was reported as an unhandled rejection and failed the scenario in about 1 run in 30 (#9).
- Fixed CI on a clean checkout by building `@lop/domain-core` before typecheck and tests (#1).

### Removed

- Removed the Angular compiler cache from version control (#4).
