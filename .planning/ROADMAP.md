# Roadmap: Workshop Inspection Scan Statistics System

**Created:** 2026-05-06
**Mode:** Interactive
**Granularity:** Standard
**Time basis:** Beijing natural day for v1

## Overview

This roadmap builds the system as a deployable internal Web application in six phases. The sequence prioritizes data integrity and scan workflow first, then master data, special barcode rules, analytics, and final UI hardening.

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 1 | Foundation, Auth, and Data Model | Establish the app shell, backend API structure, SQLite schema, authentication, role gates, production-line login, and Beijing-time handling. | AUTH-01..04, ROLE-01..04, PLAT-01..03 |
| 2 | Inspection Scanning Core | Implement scanner-driven inspection entry, simulated lookup, qualified/unqualified submission, current-day detail list, and barcode duplicate/rework rules. | SCAN-01..09, BARC-01..05 |
| 3 | Master Data Administration | Implement user, role, password reset, defect reason, and production-line administration with reference protection. | MSTR-01..08 |
| 4 | Special Barcode Workflows | Implement dirty-barcode and no-barcode product configuration, UUID preview/save, auto-unqualified submission, and local part-number matching. | SPEC-01..07 |
| 5 | Query Analysis and Dashboard | Implement ECharts monthly dashboard and detail query with filters using Beijing-time month/date boundaries. | DASH-01..07, QRY-01..07 |
| 6 | Layout, Theming, Integration Boundary, and UAT Polish | Finalize light/dark mode, role-aware navigation, panel swapping, scanner ergonomics, and real API replacement boundary. | SCAN-10, UI-01..05, PLAT-04 |

## Phase Details

### Phase 1: Foundation, Auth, and Data Model

**Goal:** Build the deployable application skeleton with durable SQLite persistence, login/session behavior, role enforcement, production-line selection, and centralized Beijing-time business-date utilities.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, ROLE-01, ROLE-02, ROLE-03, ROLE-04, PLAT-01, PLAT-02, PLAT-03

**Success Criteria:**
1. A user can log in, select a production line, and receive a role-scoped session.
2. Frontend routes and backend APIs both reject access outside the user's role.
3. SQLite persists users, roles, production lines, defect reasons, special barcode configs, and inspection records.
4. Beijing-time helper functions are used for stored scan timestamps and business-date grouping.
5. The app can run locally as a full-stack Web system with a seeded administrator and 14 production lines.

**UI hint:** yes

**Plans:**

| Plan | Wave | Objective | Requirements | Status |
|------|------|-----------|--------------|--------|
| 01-01 | 1 | Monorepo scaffold and baseline tooling | PLAT-02 | Complete 2026-05-06 |
| 01-02 | 2 | Prisma schema, seed data, production lines, and Beijing-time utilities | PLAT-01, PLAT-03, AUTH-02 | Complete 2026-05-06 |
| 01-03 | 3 | Authentication, one-active-session policy, and backend RBAC | AUTH-01, AUTH-02, AUTH-04, ROLE-04, PLAT-02, PLAT-03 | Complete 2026-05-06 |
| 01-04 | 4 | Web login flow, role-aware app shell, and session-expired UX | AUTH-01, AUTH-02, AUTH-03, AUTH-04, ROLE-01, ROLE-02, ROLE-03, ROLE-04, PLAT-02 | Complete 2026-05-06 |

### Phase 2: Inspection Scanning Core

**Goal:** Deliver the primary inspection station workflow: scan input, simulated part lookup, qualified and unqualified submission, current-day selected-line detail list, and strict barcode result rules.

**Requirements:** SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05, SCAN-06, SCAN-07, SCAN-08, SCAN-09, BARC-01, BARC-02, BARC-03, BARC-04, BARC-05

**Success Criteria:**
1. Pressing Enter in the scan input resolves part information through the simulated lookup service.
2. Clicking Qualified immediately creates a qualified record unless that barcode already has a qualified record.
3. Clicking Unqualified requires at least one active defect reason before Submit can create an unqualified record.
4. The same barcode can have repeated unqualified records and later one final qualified record.
5. The detail panel shows today's Beijing-time records for the selected production line after each submission.

**UI hint:** yes

### Phase 3: Master Data Administration

**Goal:** Give administrators complete control over users, defect reasons, and production lines while preserving historical record integrity.

**Requirements:** MSTR-01, MSTR-02, MSTR-03, MSTR-04, MSTR-05, MSTR-06, MSTR-07, MSTR-08

**Success Criteria:**
1. Administrator can create, update, disable, and delete unreferenced users and assign roles.
2. Administrator can reset passwords for Inspector and Query user accounts.
3. Defect reasons can be managed until referenced by inspection records.
4. Referenced defect reasons cannot be edited or deleted and can only be disabled.
5. Production lines are seeded to 14 by default and remain manageable by administrators.

**UI hint:** yes

### Phase 4: Special Barcode Workflows

**Goal:** Support real workshop exceptions where dirty or missing product barcodes still need statistically correct inspection records.

**Requirements:** SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05, SPEC-06, SPEC-07

**Success Criteria:**
1. Administrator can generate UUID-format dirty barcodes, preview them, save them, and manage their active state.
2. Scanning an active dirty barcode automatically records an unqualified result with reason "条码污损".
3. Administrator can generate UUID-format no-barcode product entries with vehicle model and part number.
4. Scanning an active no-barcode product barcode uses configured part data without calling the simulated lookup service.
5. Special barcode flows obey the same duplicate/rework rules as normal scan submissions.

**UI hint:** yes

### Phase 5: Query Analysis and Dashboard

**Goal:** Provide query users and administrators with monthly operational visibility and searchable inspection history.

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, QRY-01, QRY-02, QRY-03, QRY-04, QRY-05, QRY-06, QRY-07

**Success Criteria:**
1. Query Analysis contains Dashboard and Detail Query tabs.
2. Dashboard displays current-month workshop and production-line total, qualified, and unqualified counts.
3. ECharts visualizes current-month product distribution and unqualified distribution by part number.
4. Dashboard calculations use Beijing-time month boundaries.
5. Detail query supports filters for date range, production line, barcode, part number, result, and defect reason.
6. Detail results show all fields needed to audit scan history.

**UI hint:** yes

### Phase 6: Layout, Theming, Integration Boundary, and UAT Polish

**Goal:** Finish the operator experience and prepare the codebase for real plant integration after v1.

**Requirements:** SCAN-10, UI-01, UI-02, UI-03, UI-04, UI-05, PLAT-04

**Success Criteria:**
1. The scanning page supports swapping the three panel positions and persists the preferred layout locally.
2. Every screen supports light and dark modes with persisted preference.
3. Navigation exposes only role-allowed modules.
4. Scan screen keyboard flow is fast enough for scanner-first work without mouse dependency for normal qualified scans.
5. The simulated scan lookup is isolated behind a service interface that can be replaced by a real API implementation.

**UI hint:** yes

## Coverage

All 61 v1 requirements are mapped to exactly one phase.

## Next Step

Run `$gsd-discuss-phase 1` to clarify implementation approach for the foundation phase, or `$gsd-ui-phase 1` first if you want a UI contract before planning.

---
*Roadmap created: 2026-05-06*
