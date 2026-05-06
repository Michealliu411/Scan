# Requirements: Workshop Inspection Scan Statistics System

**Defined:** 2026-05-06
**Core Value:** Inspection stations can quickly and reliably record scan results, enforce duplicate rules, and produce trustworthy Beijing-time daily/monthly quality statistics by workshop, production line, and part number.

## v1 Requirements

### Authentication and Session

- [ ] **AUTH-01**: User can log in with username and password.
- [x] **AUTH-02**: User can select a production line during login.
- [ ] **AUTH-03**: Browser stores the last successful login user and production line as defaults for the next login.
- [ ] **AUTH-04**: User can log out and clear the active session.

### Roles and Access

- [ ] **ROLE-01**: Inspector role can access only the inspection scanning screen.
- [ ] **ROLE-02**: Query user role can access only query analysis screens.
- [ ] **ROLE-03**: Administrator role can access scanning, query analysis, and all master-data screens.
- [ ] **ROLE-04**: Unauthorized routes and actions are blocked on both frontend navigation and backend API checks.

### Inspection Scanning

- [ ] **SCAN-01**: Inspector can scan or type a barcode and press Enter to resolve part information through the simulated scan lookup service.
- [ ] **SCAN-02**: Scan input panel shows resolved product or part information clearly before submission.
- [ ] **SCAN-03**: Inspector can click Qualified to immediately submit a qualified inspection record.
- [ ] **SCAN-04**: Inspector can click Unqualified to reveal active defect reasons with none selected by default.
- [ ] **SCAN-05**: Unqualified submission is blocked until at least one defect reason is selected.
- [ ] **SCAN-06**: Inspector can submit an unqualified inspection record with selected reason or reasons.
- [ ] **SCAN-07**: The scan action panel includes Qualified, Unqualified, and Submit actions with valid enabled/disabled states.
- [ ] **SCAN-08**: The current-day detail panel shows records for the selected production line with product/part information, scan time, qualified/unqualified result, and defect reasons.
- [ ] **SCAN-09**: Scan detail data is grouped by Beijing natural day for v1.
- [ ] **SCAN-10**: The three scan page panels can swap horizontal positions and retain the user's preferred layout locally.

### Barcode Rules

- [ ] **BARC-01**: A barcode that already has a qualified record cannot be submitted as qualified again.
- [ ] **BARC-02**: A barcode can have multiple unqualified records to support repeated rework inspections.
- [ ] **BARC-03**: A barcode with prior unqualified records can later be submitted as qualified once.
- [ ] **BARC-04**: Duplicate qualified submission attempts show a clear blocking message.
- [ ] **BARC-05**: Barcode matching rules run consistently for normal scans, dirty-barcode configuration, and no-barcode product configuration.

### Special Barcode Configuration

- [ ] **SPEC-01**: Administrator can create, view, update, disable, and delete unreferenced dirty-barcode configurations.
- [ ] **SPEC-02**: System generates dirty-barcode values in UUID format and supports preview before saving.
- [ ] **SPEC-03**: When a scanned barcode matches an active dirty-barcode configuration, the system auto-submits an unqualified record with reason "条码污损".
- [ ] **SPEC-04**: Administrator can create, view, update, disable, and delete unreferenced no-barcode product configurations.
- [ ] **SPEC-05**: System generates no-barcode product barcode values in UUID format and supports preview before saving.
- [ ] **SPEC-06**: No-barcode product configuration stores vehicle model and part number.
- [ ] **SPEC-07**: When a scanned barcode matches an active no-barcode product configuration, the system uses the configured part number and does not call the simulated scan API.

### Dashboard Analytics

- [ ] **DASH-01**: Query users and administrators can open a query analysis module with Dashboard and Detail Query tabs.
- [ ] **DASH-02**: Dashboard displays current-month workshop-level total output, qualified output, and unqualified output.
- [ ] **DASH-03**: Dashboard displays current-month production-line-level total output, qualified output, and unqualified output.
- [ ] **DASH-04**: Dashboard displays current-month product distribution by part number using ECharts.
- [ ] **DASH-05**: Dashboard displays current-month unqualified distribution by part number using ECharts.
- [ ] **DASH-06**: Dashboard calculations use Beijing time month boundaries.
- [ ] **DASH-07**: Dashboard can filter or drill by production line where applicable.

### Detail Query

- [ ] **QRY-01**: Detail query supports filtering inspection records by date range.
- [ ] **QRY-02**: Detail query supports filtering by production line.
- [ ] **QRY-03**: Detail query supports filtering by barcode.
- [ ] **QRY-04**: Detail query supports filtering by part number.
- [ ] **QRY-05**: Detail query supports filtering by qualified/unqualified result.
- [ ] **QRY-06**: Detail query supports filtering by defect reason.
- [ ] **QRY-07**: Detail query results show scan time, production line, barcode, vehicle model when available, part number, result, defect reasons, and inspector.

### Master Data

- [ ] **MSTR-01**: Administrator can create, view, update, disable, and delete users.
- [ ] **MSTR-02**: Administrator can assign each user one of Inspector, Query user, or Administrator roles.
- [ ] **MSTR-03**: Administrator can reset passwords for Inspector and Query user accounts.
- [ ] **MSTR-04**: Administrator can create, view, update, disable, and delete defect reasons.
- [ ] **MSTR-05**: Referenced defect reasons cannot be edited or deleted.
- [ ] **MSTR-06**: Referenced defect reasons can be disabled to prevent future selection.
- [ ] **MSTR-07**: System seeds 14 default production lines.
- [ ] **MSTR-08**: Administrator can create, view, update, disable, and delete production lines.

### UI and Theming

- [ ] **UI-01**: Login screen supports production-line selection.
- [ ] **UI-02**: All screens support light mode and dark mode.
- [ ] **UI-03**: The selected theme persists locally for the user's browser.
- [ ] **UI-04**: Navigation only shows modules allowed by the current user's role.
- [ ] **UI-05**: Inspection scanning screen is optimized for fast scanner-driven operation.

### Platform and Data

- [x] **PLAT-01**: Backend stores users, roles, production lines, defect reasons, special barcodes, and inspection records in SQLite.
- [x] **PLAT-02**: Backend exposes API boundaries for authentication, scanning, analytics, detail query, and master data.
- [x] **PLAT-03**: Backend centralizes Beijing-time date handling for scan records and analytics.
- [ ] **PLAT-04**: Simulated scan lookup service can be replaced later by a real external API without rewriting scan submission logic.

## v2 Requirements

### Shift Scheduling

- **SHFT-01**: Administrator can configure shift definitions and day-boundary rules.
- **SHFT-02**: Scanning detail panel can show current shift instead of current natural day.
- **SHFT-03**: Dashboard and detail query can filter by shift.

### Real Integration

- **INTG-01**: Backend can call the real plant barcode lookup API.
- **INTG-02**: Backend can record external API errors and retry or fallback according to plant rules.

### Reporting Enhancements

- **RPT-01**: Users can export detail query results.
- **RPT-02**: Dashboard can compare month-over-month quality trends.
- **RPT-03**: Dashboard can show defect reason distribution in addition to defect part distribution.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Formal shift management in v1 | User explicitly deferred shifts; v1 uses Beijing natural day. |
| Real scan API integration in v1 | User selected simulated API first to complete the system loop. |
| Cloud deployment | Target deployment is an internal network server. |
| Mobile app | Current workflow targets browser-based scan stations. |
| ERP/MES write-back | Not requested for v1 and would require external interface details. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| ROLE-01 | Phase 1 | Pending |
| ROLE-02 | Phase 1 | Pending |
| ROLE-03 | Phase 1 | Pending |
| ROLE-04 | Phase 1 | Pending |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| SCAN-01 | Phase 2 | Pending |
| SCAN-02 | Phase 2 | Pending |
| SCAN-03 | Phase 2 | Pending |
| SCAN-04 | Phase 2 | Pending |
| SCAN-05 | Phase 2 | Pending |
| SCAN-06 | Phase 2 | Pending |
| SCAN-07 | Phase 2 | Pending |
| SCAN-08 | Phase 2 | Pending |
| SCAN-09 | Phase 2 | Pending |
| BARC-01 | Phase 2 | Pending |
| BARC-02 | Phase 2 | Pending |
| BARC-03 | Phase 2 | Pending |
| BARC-04 | Phase 2 | Pending |
| BARC-05 | Phase 2 | Pending |
| MSTR-01 | Phase 3 | Pending |
| MSTR-02 | Phase 3 | Pending |
| MSTR-03 | Phase 3 | Pending |
| MSTR-04 | Phase 3 | Pending |
| MSTR-05 | Phase 3 | Pending |
| MSTR-06 | Phase 3 | Pending |
| MSTR-07 | Phase 3 | Pending |
| MSTR-08 | Phase 3 | Pending |
| SPEC-01 | Phase 4 | Pending |
| SPEC-02 | Phase 4 | Pending |
| SPEC-03 | Phase 4 | Pending |
| SPEC-04 | Phase 4 | Pending |
| SPEC-05 | Phase 4 | Pending |
| SPEC-06 | Phase 4 | Pending |
| SPEC-07 | Phase 4 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |
| DASH-05 | Phase 5 | Pending |
| DASH-06 | Phase 5 | Pending |
| DASH-07 | Phase 5 | Pending |
| QRY-01 | Phase 5 | Pending |
| QRY-02 | Phase 5 | Pending |
| QRY-03 | Phase 5 | Pending |
| QRY-04 | Phase 5 | Pending |
| QRY-05 | Phase 5 | Pending |
| QRY-06 | Phase 5 | Pending |
| QRY-07 | Phase 5 | Pending |
| SCAN-10 | Phase 6 | Pending |
| UI-01 | Phase 6 | Pending |
| UI-02 | Phase 6 | Pending |
| UI-03 | Phase 6 | Pending |
| UI-04 | Phase 6 | Pending |
| UI-05 | Phase 6 | Pending |
| PLAT-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 61 total
- Mapped to phases: 61
- Unmapped: 0

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 after initialization*
