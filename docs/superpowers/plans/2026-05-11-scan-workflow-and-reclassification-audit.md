# Scan Workflow And Reclassification Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement qualified auto-submit, revised unqualified scan flow, qualified-to-unqualified reclassification, and audit log querying.

**Architecture:** Keep scanning behavior in `InspectionScanningPage`, reclassification and logs in `detail-query`, and persist audit rows through Prisma. Reuse current role guards and active defect reason lists.

**Tech Stack:** NestJS, Prisma, SQLite, React, TypeScript, Vitest, Jest e2e.

---

### Task 1: Backend Reclassification And Logs

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/prisma/migrations/20260506053000_init/migration.sql`
- Modify: `apps/api/src/detail-query/detail-query.controller.ts`
- Modify: `apps/api/src/detail-query/detail-query.service.ts`
- Test: `apps/api/test/detail-query.e2e-spec.ts`

- [ ] Write failing e2e tests for qualified-to-unqualified mutation and audit log query.
- [ ] Run the detail-query e2e suite and verify the new tests fail because endpoints/models are missing.
- [ ] Add Prisma model/table and service/controller methods.
- [ ] Run the detail-query e2e suite and verify it passes.

### Task 2: Frontend Query UI

**Files:**
- Modify: `apps/web/src/query/query-types.ts`
- Modify: `apps/web/src/query/query-api.ts`
- Modify: `apps/web/src/query/QueryAnalysisPage.tsx`
- Test: `apps/web/src/query/QueryAnalysisPage.test.tsx`

- [ ] Write failing component tests for reclassification and operation-log query.
- [ ] Implement query API helpers, modal/UI state, and the operation record tab.
- [ ] Run the query page tests and verify they pass.

### Task 3: Frontend Scanning Flow

**Files:**
- Modify: `apps/web/src/scanning/InspectionScanningPage.tsx`
- Test: `apps/web/src/scanning/InspectionScanningPage.test.tsx`

- [ ] Write failing component tests for qualified auto-submit and unqualified preselect flow.
- [ ] Remove the qualified button and auto-submit qualified records after lookup unless unqualified mode is active.
- [ ] Run scanning page tests and verify they pass.

### Task 4: Verification And State

**Files:**
- Modify: `.planning/STATE.md`

- [ ] Run focused backend and frontend tests.
- [ ] Run typecheck/lint if available.
- [ ] Update project state recent activity with the new adjustment.
