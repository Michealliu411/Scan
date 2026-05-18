---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: post-v1-baseline-ready
status: Post-v1 baseline aligned; next milestone framing pending
last_updated: "2026-05-18T12:00:12+08:00"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 19
  completed_plans: 19
  percent: 100
---

# Project State: Workshop Inspection Scan Statistics System

**Initialized:** 2026-05-06
**Current phase:** Post-v1 baseline ready
**Workflow mode:** Interactive

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-18)

**Core value:** Inspection stations can quickly and reliably record scan results, enforce duplicate rules, and produce trustworthy Beijing-time daily/monthly quality statistics by workshop, production line, and part number.
**Current focus:** Prepare a clean Windows intranet deployment package for the target server at `192.168.1.144`, with reset baseline data limited to the administrator account and default production line.

## Current Decisions

- Web full-stack system for internal network deployment.
- Frontend: React + TypeScript + ECharts.
- Backend: NestJS.
- Database: SQLite via Prisma.
- Business time: Beijing time.
- Timestamp storage: UTC instants, with Asia/Shanghai business-day and month boundaries computed in backend utilities.
- v1 statistics period: Beijing natural day/month; formal shifts deferred.
- Scan lookup: the normal path now uses the configurable real water-wash-label interface through `SCAN_LOOKUP_URL`; active special-barcode rules resolve locally first.
- Duplicate rule: qualified barcode is terminal; after a barcode has a qualified record it cannot be submitted as qualified again or unqualified. Unqualified records can repeat before the final qualified record to support reinspection.
- Phase 2 scan display: show part number first and vehicle model second after lookup.
- Phase 2 lookup failure: keep the barcode input and show a clear not-found retry message.
- Phase 2 submission flow: Qualified submits immediately; Unqualified reveals multi-select defect reasons and requires Submit.
- Phase 2 detail list: current Beijing-day records newest first, re-fetched after submission, showing time, barcode, part number, vehicle model, result, and defect reasons.
- Phase 3 scope: implement complete master-data administration in one phase, not a backend-only or reduced subset.
- Phase 3 reference protection: backend must enforce deletion/editing safety for referenced master data; frontend reflects operation flags but is not trusted for integrity.
- Authentication: httpOnly cookie sessions.
- Login mutual exclusion: newest login invalidates any prior session for the same user; old terminal is redirected on next request.
- Project structure: monorepo with `apps/web` and `apps/api`.
- Field servers are offline. Packages should be offline-friendly by default, and any release that requires server-side internet access, dependency installation, or database migration must call that out before handoff.
- Seed administrator: username `admin`, initial password `admin`, forced first-login password change.
- Planning docs stay local-only and are excluded from git.
- Phase 6 created the lookup gateway boundary; the post-v1 pass has now replaced the normal simulated provider with the real configurable lookup service.
- Scan lookup now uses the real configurable water-wash-label production-order interface by default, with `SCAN_LOOKUP_URL` controlling the intranet endpoint and the existing special-barcode rules taking priority before external lookup.
- Dashboard full-screen is implemented as page-level full-screen mode in the query analysis module, with Escape as the keyboard exit path.
- Dashboard total output and unqualified counts are distinct-barcode statistics: repeated scans of the same barcode count once for total output, and repeated unqualified records for the same barcode count once for unqualified output and unqualified part distribution.
- Scan parsing UI includes a clear action to reset barcode input, parsed part data, selected defect reasons, and transient messages after a wrong scan.
- The three inspection action buttons in the scanning operation panel are intentionally larger than standard buttons for workshop use.
- Master-data editing is field-scoped: user rows expose role editing; unreferenced defect reasons expose name editing; production lines expose name editing even after reference; unreferenced special barcodes expose dirty-barcode reason editing or no-barcode product vehicle model and part number editing.
- Built-in admin account cannot be edited through master data. Every logged-in user can change their own password from the top bar after entering the current password.
- Defect reasons and production lines support active-state toggling from master data lists.
- Dashboard production-line monthly totals are shown as a grouped bar chart instead of the previous middle summary table.
- Trial-run feedback added larger equal-sized operation buttons, current-day default query dates, Excel-only exports, independent operator profiles with Excel import, unqualified-inspection operator selection by pinyin initials, and defect-code deduction amounts with unqualified deduction totals.

## Roadmap Position

1. Phase 1 - Foundation, Auth, and Data Model: Complete (4/4 plans complete)
2. Phase 2 - Inspection Scanning Core: Implemented (3/3 plans complete; human visual UAT carried forward)
3. Phase 3 - Master Data Administration: Verified (3/3 plans complete; browser admin workflow UAT passed)
4. Phase 4 - Special Barcode Workflows: Verified (3/3 plans complete; browser special barcode UAT passed)
5. Phase 5 - Query Analysis and Dashboard: Verified (3/3 plans complete; browser query/admin UAT passed)
6. Phase 6 - Layout, Theming, Integration Boundary, and UAT Polish: Verified (3/3 plans complete; browser theme/layout/scanner/role UAT passed)

## Open Questions / Carried Verification Debt

- No v1 verification debt currently tracked.
- Next-phase planning should decide whether field hardening becomes a small `v1.1` milestone or the first formal `v2` phase.

## Recent Activity

- 2026-05-06: Initialized GSD project context, requirements, roadmap, and local planning config.
- 2026-05-06: Captured Phase 1 context decisions for NestJS, Prisma, httpOnly cookie sessions, one-active-login policy, monorepo structure, seeded admin credentials, and Beijing-time boundary handling.
- 2026-05-06: Captured Phase 1 research, validation strategy, and UI design contract for login/app-shell foundation.
- 2026-05-06: Planned Phase 1 into 4 sequential plans covering monorepo scaffold, Prisma/data/time utilities, auth/RBAC API, and frontend login/app shell.
- 2026-05-06: Completed Plan 01-01 with pnpm monorepo scaffold, NestJS health API, React/Vite web shell, lockfile, typecheck, and tests.
- 2026-05-06: Completed Plan 01-02 with Prisma SQLite schema, initial migration SQL, hashed admin seed, 14 production lines, Beijing-time utilities, and production-line lookup API.
- 2026-05-06: Completed Plan 01-03 with backend auth APIs, httpOnly cookie sessions, newest-login-wins invalidation, session/RBAC guards, password-change support, and auth e2e tests.
- 2026-05-06: Completed Plan 01-04 with frontend login, production-line defaults, first-password-change screen, role-aware app shell, logout, and session-expired UX.
- 2026-05-07: Completed Phase 1 browser UAT for login, forced password change, and role-scoped app shell visual pass.
- 2026-05-07: Captured Phase 2 context decisions for scan lookup display, failed lookup handling, qualified/unqualified submission, duplicate/rework rules, and current-day detail refresh/list fields.
- 2026-05-07: Created Phase 2 UI design contract for the inspection scanning workstation layout, controls, copy, colors, typography, and detail-list behavior.
- 2026-05-07: Researched Phase 2 backend/frontend implementation approach and validation strategy.
- 2026-05-07: Planned Phase 2 into 3 sequential plans covering backend scanning API/rules, frontend scanning workstation, and cross-layer hardening/verification.
- 2026-05-07: Paused work before Phase 2 execution and wrote handoff files: `.planning/HANDOFF.json` and `.planning/phases/02-inspection-scanning-core/.continue-here.md`.
- 2026-05-07: Completed Plan 02-01 with backend scanning lookup, active defect reason listing, inspection record creation, duplicate/rework rules, current Beijing-day detail retrieval, RBAC-protected endpoints, and scanning e2e coverage.
- 2026-05-07: Completed Plan 02-02 with frontend scanning workstation, API client, AppShell wiring, Vite scanning proxy, CSS, and component tests.
- 2026-05-07: Completed Plan 02-03 with cross-layer coverage audit, full verification commands, and `02-VERIFICATION.md` marked `human_needed` for visual scanner workstation UAT.
- 2026-05-07: User selected full Phase 3 scope. Created Phase 3 context, UI contract, research, validation strategy, and three execution plans.
- 2026-05-07: Completed Plan 03-01 with administrator-only master-data APIs, backend reference protection, password reset behavior, DTO validation, and backend e2e coverage.
- 2026-05-07: Completed Plan 03-02 with administrator master-data workspace, tabbed lists, create flows, password reset, reference-protection UI, and frontend component coverage.
- 2026-05-07: Completed Plan 03-03 with full project verification and Phase 3 verification report.
- 2026-05-07: Completed Phase 3 browser admin workflow UAT; fixed `/master-data` Vite proxy and root `pnpm dev` full-stack startup coverage.
- 2026-05-07: Created Phase 4 context, UI contract, research, validation strategy, and three execution plans for special barcode workflows.
- 2026-05-07: Completed Plan 04-01 with special barcode admin APIs, UUID generation, backend reference protection, dirty auto-submit scan matching, no-barcode product lookup matching, and backend e2e coverage.
- 2026-05-07: Completed Plan 04-02 with the special barcode admin tab, UUID preview/create flows, scanner dirty auto-submit handling, and frontend tests.
- 2026-05-07: Completed Plan 04-03 with full project verification, browser special barcode UAT, Phase 4 verification report, and requirement status updates.
- 2026-05-07: Created Phase 5 context, UI contract, research, validation strategy, and three execution plans for query analysis and dashboard.
- 2026-05-07: Completed Plan 05-01 with backend analytics dashboard API, detail-query records API, Beijing detail date-range helper, and backend e2e coverage.
- 2026-05-07: Completed Plan 05-02 with frontend query analysis workspace, ECharts dashboard panels, detail-query filters/results, Vite proxy routes, and frontend coverage.
- 2026-05-07: Completed Plan 05-03 with full workspace verification, browser query/admin UAT, Phase 05 verification report, and requirement status updates.
- 2026-05-07: Saved pause handoff before Phase 06 start.
- 2026-05-07: Created Phase 06 context, UI contract, and three execution plans for theming, scanner layout, lookup boundary, and final UAT.
- 2026-05-07: Completed Plan 06-01 with persisted light/dark theme toggle and role-navigation coverage.
- 2026-05-07: Completed Plan 06-02 with persisted scanner layout presets, adaptive workstation grid, and scanner focus coverage.
- 2026-05-07: Completed Plan 06-03 with scan lookup gateway boundary, full verification, browser UAT, and requirement status sync.
- 2026-05-07: Added dashboard full-screen viewing polish with component coverage, frontend typecheck, and frontend lint verification.
- 2026-05-09: Captured post-v1 adjustment direction for terminal qualified barcode locking, distinct-barcode output/unqualified dashboard statistics, scan parse clear action, and larger inspection operation buttons.
- 2026-05-09: Added post-v1 master-data edit direction for user roles, defect reason names before reference, production line names regardless of reference, and unreferenced special barcode details.
- 2026-05-09: Added admin account edit lock and a logged-in self-service password change entry in the app top bar.
- 2026-05-09: Added master-data active-state toggles for defect reasons and production lines.
- 2026-05-09: Replaced the dashboard production-line totals table with a grouped bar chart for total output, qualified count, and unqualified count.
- 2026-05-09: Adjusted dashboard fullscreen layout to fit within variable display sizes by distributing viewport height across KPI and chart regions without overflow.
- 2026-05-11: Changed test-data seeding to reset business data, keep only admin, LINE-01, and 条码污损, while preserving existing special barcode records.
- 2026-05-11: Expanded initial defect-reason seed data with A0-A41 production defect codes while keeping 条码污损 for dirty barcode workflows.
- 2026-05-11: Adjusted special barcode scan submissions so active special barcodes can be recorded repeatedly as qualified or unqualified without the normal terminal qualified lock.
- 2026-05-11: Fixed master-data delete operations by wiring user, defect reason, and production-line delete buttons to their backend APIs and refresh flows.
- 2026-05-11: Adjusted inspection scanning so normal resolved scans auto-submit as qualified, unqualified scans require preselecting defect reasons before scanning and manual submit, and query users can reclassify qualified records to unqualified with operation-log query support.
- 2026-05-14: Replaced the simulated normal scan lookup provider with a configurable real production-order lookup endpoint at `SCAN_LOOKUP_URL`, defaulting to `http://192.168.1.151/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai`.
- 2026-05-18: Aligned project docs with the implemented post-v1 baseline and recommended the next phase focus on field hardening and delivery reliability.
- 2026-05-18: Captured offline-server packaging constraint: update packages should avoid server-side network access by default, and any unavoidable online/dependency/migration requirement must be surfaced during packaging.
- 2026-05-18: Implemented trial-run feedback covering larger equal operation buttons, today-default query dates, Excel exports, operator profiles/import/search, and defect-code deduction amounts.
- 2026-05-18: Reset the local packaged SQLite baseline to only `admin` and `LINE-01/产线01`, built the app for API base `http://192.168.1.144:3000`, and produced `releases/scan-windows-20260518-120012.zip`.

## Session Continuity

Last session: 2026-05-18T09:04:11+08:00
Stopped at: Post-v1 baseline aligned in planning docs; next-stage direction ready to discuss or formalize.
Resume file: none required unless opening the next milestone workflow.
