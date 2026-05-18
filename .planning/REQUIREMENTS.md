# Requirements: Workshop Inspection Scan Statistics System

**Defined:** 2026-05-06
**Core Value:** Inspection stations can quickly and reliably record scan results, enforce duplicate rules, and produce trustworthy Beijing-time daily/monthly quality statistics by workshop, production line, and part number.

## v1 Requirements

### Authentication and Session

- [x] **AUTH-01**: User can log in with username and password.
- [x] **AUTH-02**: User can select a production line during login.
- [x] **AUTH-03**: Browser stores the last successful login user and production line as defaults for the next login.
- [x] **AUTH-04**: User can log out and clear the active session.

### Roles and Access

- [x] **ROLE-01**: Inspector role can access only the inspection scanning screen.
- [x] **ROLE-02**: Query user role can access only query analysis screens.
- [x] **ROLE-03**: Administrator role can access scanning, query analysis, and all master-data screens.
- [x] **ROLE-04**: Unauthorized routes and actions are blocked on both frontend navigation and backend API checks.

### Inspection Scanning

- [x] **SCAN-01**: Inspector can scan or type a barcode and resolve part information through the scan lookup boundary.
- [x] **SCAN-02**: Scan input panel shows resolved product or part information clearly before submission.
- [x] **SCAN-03**: Inspector can click Qualified to immediately submit a qualified inspection record.
- [x] **SCAN-04**: Inspector can click Unqualified to reveal active defect reasons with none selected by default.
- [x] **SCAN-05**: Unqualified submission is blocked until at least one defect reason is selected.
- [x] **SCAN-06**: Inspector can submit an unqualified inspection record with selected reason or reasons.
- [x] **SCAN-07**: The scan action panel includes Qualified, Unqualified, and Submit actions with valid enabled/disabled states.
- [x] **SCAN-08**: The current-day detail panel shows records for the selected production line with product/part information, scan time, qualified/unqualified result, and defect reasons.
- [x] **SCAN-09**: Scan detail data is grouped by Beijing natural day for v1.
- [x] **SCAN-10**: The three scan page panels can swap horizontal positions and retain the user's preferred layout locally.

### Barcode Rules

- [x] **BARC-01**: A barcode that already has a qualified record cannot be submitted as qualified again.
- [x] **BARC-02**: A barcode can have multiple unqualified records to support repeated rework inspections.
- [x] **BARC-03**: A barcode with prior unqualified records can later be submitted as qualified once.
- [x] **BARC-04**: Duplicate qualified submission attempts show a clear blocking message.
- [x] **BARC-05**: Barcode matching rules run consistently for normal scans, dirty-barcode configuration, and no-barcode product configuration.

### Special Barcode Configuration

- [x] **SPEC-01**: Administrator can create, view, update, disable, and delete unreferenced dirty-barcode configurations.
- [x] **SPEC-02**: System generates dirty-barcode values in UUID format and supports preview before saving.
- [x] **SPEC-03**: When a scanned barcode matches an active dirty-barcode configuration, the system auto-submits an unqualified record with reason "条码污损".
- [x] **SPEC-04**: Administrator can create, view, update, disable, and delete unreferenced no-barcode product configurations.
- [x] **SPEC-05**: System generates no-barcode product barcode values in UUID format and supports preview before saving.
- [x] **SPEC-06**: No-barcode product configuration stores vehicle model and part number.
- [x] **SPEC-07**: When a scanned barcode matches an active no-barcode product configuration, the system uses the configured part number and does not call the external lookup API.

### Dashboard Analytics

- [x] **DASH-01**: Query users and administrators can open a query analysis module with Dashboard and Detail Query tabs.
- [x] **DASH-02**: Dashboard displays current-month workshop-level total output, qualified output, and unqualified output.
- [x] **DASH-03**: Dashboard displays current-month production-line-level total output, qualified output, and unqualified output.
- [x] **DASH-04**: Dashboard displays current-month product distribution by part number using ECharts.
- [x] **DASH-05**: Dashboard displays current-month unqualified distribution by part number using ECharts.
- [x] **DASH-06**: Dashboard calculations use Beijing time month boundaries.
- [x] **DASH-07**: Dashboard can filter or drill by production line where applicable.
- [x] **DASH-08**: Dashboard can expand into a full-screen view and exit with Escape.

### Detail Query

- [x] **QRY-01**: Detail query supports filtering inspection records by date range.
- [x] **QRY-02**: Detail query supports filtering by production line.
- [x] **QRY-03**: Detail query supports filtering by barcode.
- [x] **QRY-04**: Detail query supports filtering by part number.
- [x] **QRY-05**: Detail query supports filtering by qualified/unqualified result.
- [x] **QRY-06**: Detail query supports filtering by defect reason.
- [x] **QRY-07**: Detail query results show scan time, production line, barcode, vehicle model when available, part number, result, defect reasons, and inspector.

### Master Data

- [x] **MSTR-01**: Administrator can create, view, update, disable, and delete users.
- [x] **MSTR-02**: Administrator can assign each user one of Inspector, Query user, or Administrator roles.
- [x] **MSTR-03**: Administrator can reset passwords for Inspector and Query user accounts.
- [x] **MSTR-04**: Administrator can create, view, update, disable, and delete defect reasons.
- [x] **MSTR-05**: Referenced defect reasons cannot be edited or deleted.
- [x] **MSTR-06**: Referenced defect reasons can be disabled to prevent future selection.
- [x] **MSTR-07**: System seeds 14 default production lines.
- [x] **MSTR-08**: Administrator can create, view, update, disable, and delete production lines.

### UI and Theming

- [x] **UI-01**: Login screen supports production-line selection.
- [x] **UI-02**: All screens support light mode and dark mode.
- [x] **UI-03**: The selected theme persists locally for the user's browser.
- [x] **UI-04**: Navigation only shows modules allowed by the current user's role.
- [x] **UI-05**: Inspection scanning screen is optimized for fast scanner-driven operation.

### Platform and Data

- [x] **PLAT-01**: Backend stores users, roles, production lines, defect reasons, special barcodes, and inspection records in SQLite.
- [x] **PLAT-02**: Backend exposes API boundaries for authentication, scanning, analytics, detail query, and master data.
- [x] **PLAT-03**: Backend centralizes Beijing-time date handling for scan records and analytics.
- [x] **PLAT-04**: Simulated scan lookup service can be replaced later by a real external API without rewriting scan submission logic.

## Post-v1 Implemented Adjustments

- [x] **ADJ-01**: Normal resolved scans auto-submit as qualified records.
- [x] **ADJ-02**: Unqualified scans require entering unqualified mode, preselecting defect reasons, then manually submitting after scan resolution.
- [x] **ADJ-03**: Qualified barcodes are terminal for normal barcodes; after qualification they cannot be recorded again as qualified or unqualified.
- [x] **ADJ-04**: Active special barcodes can still be recorded repeatedly according to their configured exception workflow.
- [x] **ADJ-05**: Dashboard total output and unqualified metrics count distinct barcodes rather than repeated records.
- [x] **ADJ-06**: Query users and administrators can reclassify qualified records to unqualified with auditable operation logs.
- [x] **ADJ-07**: Administrators can edit safe master-data fields, toggle active state for defect reasons and production lines, and users can change their own passwords.
- [x] **ADJ-08**: Normal scans call the configurable real water-wash-label lookup interface through `SCAN_LOOKUP_URL`.
- [x] **TRIAL-01**: Inspection operation buttons are larger, equal-sized, and constrained within the operation panel.
- [x] **TRIAL-02**: Detail and operation-log query date filters default to the current Beijing date.
- [x] **TRIAL-03**: Query analysis views support Excel-only export for dashboard, detail records, and operation logs.
- [x] **TRIAL-04**: Administrators can manage independent operator profiles, separated from login users, including formal-worker and labor-worker types.
- [x] **TRIAL-05**: Operator profiles can be imported from Excel.
- [x] **TRIAL-06**: Unqualified inspection supports operator selection by name, employee code, or pinyin initials without case sensitivity.
- [x] **TRIAL-07**: Defect codes support deduction amounts, and unqualified inspection accumulates selected-code deduction totals.

## v2 Requirements

### Shift Scheduling

- **SHFT-01**: Administrator can configure shift definitions and day-boundary rules.
- **SHFT-02**: Scanning detail panel can show current shift instead of current natural day.
- **SHFT-03**: Dashboard and detail query can filter by shift.

### Real Integration

- [x] **INTG-01**: Backend can call the real plant barcode lookup API.
- **INTG-02**: Backend can record external API errors and retry or fallback according to plant rules.

### Reporting Enhancements

- **RPT-01**: Users can export detail query results.
- **RPT-02**: Dashboard can compare month-over-month quality trends.
- **RPT-03**: Dashboard can show defect reason distribution in addition to defect part distribution.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Formal shift management in v1 | User explicitly deferred shifts; v1 uses Beijing natural day. |
| Cloud deployment | Target deployment is an internal network server. |
| Mobile app | Current workflow targets browser-based scan stations. |
| ERP/MES write-back | Not requested for v1 and would require external interface details. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| ROLE-01 | Phase 1 | Complete |
| ROLE-02 | Phase 1 | Complete |
| ROLE-03 | Phase 1 | Complete |
| ROLE-04 | Phase 1 | Complete |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| SCAN-01 | Phase 2 | Complete |
| SCAN-02 | Phase 2 | Complete |
| SCAN-03 | Phase 2 | Complete |
| SCAN-04 | Phase 2 | Complete |
| SCAN-05 | Phase 2 | Complete |
| SCAN-06 | Phase 2 | Complete |
| SCAN-07 | Phase 2 | Complete |
| SCAN-08 | Phase 2 | Complete |
| SCAN-09 | Phase 2 | Complete |
| BARC-01 | Phase 2 | Complete |
| BARC-02 | Phase 2 | Complete |
| BARC-03 | Phase 2 | Complete |
| BARC-04 | Phase 2 | Complete |
| BARC-05 | Phase 2 | Complete |
| MSTR-01 | Phase 3 | Complete |
| MSTR-02 | Phase 3 | Complete |
| MSTR-03 | Phase 3 | Complete |
| MSTR-04 | Phase 3 | Complete |
| MSTR-05 | Phase 3 | Complete |
| MSTR-06 | Phase 3 | Complete |
| MSTR-07 | Phase 3 | Complete |
| MSTR-08 | Phase 3 | Complete |
| SPEC-01 | Phase 4 | Complete |
| SPEC-02 | Phase 4 | Complete |
| SPEC-03 | Phase 4 | Complete |
| SPEC-04 | Phase 4 | Complete |
| SPEC-05 | Phase 4 | Complete |
| SPEC-06 | Phase 4 | Complete |
| SPEC-07 | Phase 4 | Complete |
| DASH-01 | Phase 5 | Complete |
| DASH-02 | Phase 5 | Complete |
| DASH-03 | Phase 5 | Complete |
| DASH-04 | Phase 5 | Complete |
| DASH-05 | Phase 5 | Complete |
| DASH-06 | Phase 5 | Complete |
| DASH-07 | Phase 5 | Complete |
| DASH-08 | Phase 6 | Complete |
| QRY-01 | Phase 5 | Complete |
| QRY-02 | Phase 5 | Complete |
| QRY-03 | Phase 5 | Complete |
| QRY-04 | Phase 5 | Complete |
| QRY-05 | Phase 5 | Complete |
| QRY-06 | Phase 5 | Complete |
| QRY-07 | Phase 5 | Complete |
| SCAN-10 | Phase 6 | Complete |
| UI-01 | Phase 6 | Complete |
| UI-02 | Phase 6 | Complete |
| UI-03 | Phase 6 | Complete |
| UI-04 | Phase 6 | Complete |
| UI-05 | Phase 6 | Complete |
| PLAT-04 | Phase 6 | Complete |

**Coverage:**
- v1 requirements: 62 total
- Mapped to phases: 62
- Unmapped: 0

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-18 after post-v1 status alignment*
