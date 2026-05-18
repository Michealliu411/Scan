# Scan Workflow And Reclassification Audit Design

## Goal

Adjust inspection scanning so qualified scans submit automatically, make unqualified scans an explicit preselected workflow, and let query users convert qualified records to unqualified with an auditable operation history.

## Design

- Qualified workflow: after a normal barcode lookup resolves part data, the scanning page immediately submits a qualified record. The old qualified action button is removed.
- Unqualified workflow: the operator clicks `不合格`, selects at least one active defect reason, scans the barcode, then clicks `提交`. The page keeps defect selection before lookup and submits only when resolved part data exists.
- Reclassification: query users and administrators can change a qualified inspection record to unqualified from detail query. The backend requires at least one active defect reason, updates the original record result and defect links, clears the qualified barcode key, and stores an operation log.
- Operation records: query analysis gains an `操作记录` tab. Logs can be queried by Beijing date range, barcode, and operator username, and show original/new result, selected reasons, operation time, and operator.

## Data Model

Add `InspectionRecordChangeLog` linked to `InspectionRecord` and `User`. Store snapshot fields needed for audit query stability: barcode, part number, previous result, new result, defect reason names, operator, and timestamps.

## Testing

- Backend e2e tests cover required defect reasons, allowed query/admin access, blocked inspector access, record mutation, qualified key clearing, and log query.
- Frontend tests cover qualified auto-submit, unqualified preselect-then-scan flow, detail-row reclassification, and operation log querying.
