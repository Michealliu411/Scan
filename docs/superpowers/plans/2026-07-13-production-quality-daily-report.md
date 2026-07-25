# 生产质量日报实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在查询分析中交付可按北京自然月和产线查询、导出的一次下线生产质量日报，并兼容既有现场数据。

**Architecture:** `InspectionRecord` 增加上游产品名称和部件快照；迁移将旧 `vehicleModel` 的历史含义转存为 `productName`。后台在全量检验记录中先选择每个条码的最早记录，再以该记录进行月度、产线和日报行汇总；前端仅渲染该接口返回的固定元数据、动态缺陷列和汇总行，并从相同数据集生成 Excel。

**Tech Stack:** NestJS、Prisma/SQLite、React/TypeScript、Vitest、Supertest、SheetJS (`xlsx`)。

## Global Constraints

- 业务日期与月边界必须使用北京时间工具函数。
- 首检定义为同一 `barcode` 全生命周期 `scannedAt` 最早的记录；同一时间时以 `id` 升序稳定排序。
- 更正首检记录的结果或缺陷原因后，报表读取该记录当前值；不新增报表查询或导出日志。
- `成品车型` 和 `成品品名` 允许为空，原样持久化且不得回填猜测值。
- 报表仅允许 `QUERY`、`ADMIN`；`INSPECTOR` 必须由后端拒绝。
- 原因列按缺陷代码升序返回全部基础数据，包括停用和零计数原因。
- 本次迁移必须保留既有记录、关联原因、日志和计划数据；不得删除或重建现场数据库。

---

### Task 1: 数据快照、兼容迁移与上游字段映射

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260713150000_add_quality_report_snapshots/migration.sql`
- Modify: `apps/api/src/scanning/scan-lookup.gateway.ts`
- Modify: `apps/api/src/scanning/production-order-scan-lookup.service.ts`
- Modify: `apps/api/src/scanning/production-order-scan-lookup.service.spec.ts`
- Modify: `apps/api/src/scanning/dto/create-inspection-record.dto.ts`
- Modify: `apps/api/src/scanning/scanning.service.ts`
- Modify: `apps/web/src/scanning/scanning-types.ts`

**Interfaces:**
- Produces `ScanLookupResult` fields `productName: string | null`, `vehicleModel: string | null`, `partName: string | null`.
- Produces nullable `InspectionRecord.productName` and `InspectionRecord.partName`.
- Extends scan-record submission payloads with optional `productName` and `partName`.

- [ ] **Step 1: 编写失败的接口映射测试**

在 `production-order-scan-lookup.service.spec.ts` 新增成功响应：`成品产品名称: '原始产品'`、`成品车型: '帕萨特 B8'`、`成品品名: '驾驶座面套'`，断言返回三个独立字段；新增车型、品名均缺失的成功响应，断言返回 `null` 而非抛出“缺少产品名称”。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @scan/api test -- production-order-scan-lookup.service.spec.ts`

Expected: FAIL，因为返回类型尚未包含 `productName`、`partName`，且旧校验仍要求产品名称。

- [ ] **Step 3: 实现最小字段映射与持久化链路**

将默认地址改为 `http://192.168.1.151/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai`；保留零件号为唯一必填外部字段；将 `成品产品名称`、`成品车型`、`成品品名` 分别解析为可空值。扫码解析响应、提交 DTO、合格/不合格创建路径和响应序列化均传递三个字段。

- [ ] **Step 4: 增加 Prisma 模型与安全迁移**

在 `InspectionRecord` 增加 `productName String?`、`partName String?`。迁移执行：

```sql
ALTER TABLE "InspectionRecord" ADD COLUMN "productName" TEXT;
ALTER TABLE "InspectionRecord" ADD COLUMN "partName" TEXT;
UPDATE "InspectionRecord"
SET "productName" = "vehicleModel",
    "vehicleModel" = NULL
WHERE "vehicleModel" IS NOT NULL;
```

迁移只增加列和复制值，不删除表、索引或关联数据。

- [ ] **Step 5: 运行映射与类型检查**

Run: `pnpm --filter @scan/api test -- production-order-scan-lookup.service.spec.ts && pnpm --filter @scan/api typecheck`

Expected: PASS。

- [ ] **Step 6: 提交数据快照切片**

```bash
git add apps/api/prisma apps/api/src/scanning apps/web/src/scanning
git commit -m "feat: persist quality report product snapshots"
```

### Task 2: 首检质量日报 API、权限与统计测试

**Files:**
- Modify: `apps/api/src/analytics/analytics.service.ts`
- Modify: `apps/api/src/analytics/analytics.controller.ts`
- Modify: `apps/api/test/analytics.e2e-spec.ts`

**Interfaces:**
- Produces `GET /analytics/quality-daily-report?year=YYYY&month=MM&productionLineId=<optional>`.
- Response contains `period`, `workshop: '缝纫'`, `process: '缝纫'`, `defectReasons: [{ id, code, name }]`, and `rows`.
- Each row contains `businessDate`, production-line fields, `vehicleModel`, `partName`, `productionQuantity`, `qualifiedQuantity`, `unqualifiedQuantity`, `qualifiedRate`, and `defectCounts: Record<string, number>`.

- [ ] **Step 1: 编写失败的 API 验收测试**

扩展 `analytics.e2e-spec.ts` 的迁移初始化以应用新 SQL。新增首检案例：五月首次不合格、六月复检合格；五月首检合格；同一条码五月两次不合格；首检更正后当前结果；停用原因。断言：

```ts
expect(response.body.rows).toEqual([
  expect.objectContaining({
    businessDate: '2026-05-10',
    productionQuantity: 2,
    qualifiedQuantity: 1,
    unqualifiedQuantity: 1,
    qualifiedRate: 0.5,
    defectCounts: expect.objectContaining({ [defectReasonId]: 1 })
  })
]);
```

另加六月查询断言不含五月首检条码；按产线过滤断言只保留首检产线；`INSPECTOR` 调用返回 `403`；非法年月和未知产线返回 `400`。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @scan/api test -- analytics.e2e-spec.ts`

Expected: FAIL，因为路由尚不存在。

- [ ] **Step 3: 实现首检选择与汇总**

在 `AnalyticsService` 中先按 `{ scannedAt: 'asc' }, { id: 'asc' }` 读取所有记录及产线和缺陷关联，以 `Map<barcode, record>` 保留首条；然后按 `getBeijingMonthRange` 和可选产线筛选首条。读取全部 `DefectReason` 并按 `code`、`name` 排序；以 `日期 + 产线 + 车型 + 部件 + 工序` 建立汇总键，原因列以原因 ID 初始化为零。`qualifiedRate` 返回数值，前端统一格式化百分比。

- [ ] **Step 4: 增加受保护路由并运行 API 测试**

在 `AnalyticsController` 添加 `quality-daily-report`，复用 `@Roles(Role.QUERY, Role.ADMIN)` 和现有会话守卫。

Run: `pnpm --filter @scan/api test -- analytics.e2e-spec.ts`

Expected: PASS。

- [ ] **Step 5: 提交统计 API 切片**

```bash
git add apps/api/src/analytics apps/api/test/analytics.e2e-spec.ts
git commit -m "feat: add first-pass quality daily report api"
```

### Task 3: 质量日报页签、动态表格与 Excel 导出

**Files:**
- Modify: `apps/web/src/query/query-types.ts`
- Modify: `apps/web/src/query/query-api.ts`
- Modify: `apps/web/src/query/QueryAnalysisPage.tsx`
- Modify: `apps/web/src/query/QueryAnalysisPage.test.tsx`
- Create: `apps/web/src/query/quality-report-export.ts`
- Create: `apps/web/src/query/quality-report-export.test.ts`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes `QualityDailyReportResponse` returned by `fetchQualityDailyReport(filters)`.
- Produces `QualityReportTab`, with default Beijing current year/month, all-lines default, manual query and disabled-until-data Excel export.
- Produces `buildQualityDailyReportWorkbook(report)` with the two header rows required by the confirmed sample.

- [ ] **Step 1: 编写失败的页面和导出测试**

在 `QueryAnalysisPage.test.tsx` 模拟日报 API，点击“质量日报”后填写年份、月份、产线并点击“查询日报”，断言请求参数、`部件` 表头、零计数原因列、日报行与“导出 Excel”按钮状态。新建 `quality-report-export.test.ts`，用两条原因列断言工作表标题、合并区域、固定列标题和动态原因标题顺序。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @scan/web test -- QueryAnalysisPage.test.tsx quality-report-export.test.ts`

Expected: FAIL，因为日报类型、页签、导出构造器均不存在。

- [ ] **Step 3: 实现 API 类型、查询状态和页面**

新增 `qualityReport` 页签；默认值取浏览器当前年月。表格显示确认稿的标题、年月、生产车间“缝纫”、工序“缝纫”、固定列及动态原因列；空值显示 `-`，合格率显示为百分比；使用 `master-table-wrap` 维持横向滚动。页面不增加说明卡、数据边界说明或跨日复制功能。

- [ ] **Step 4: 实现同数据集 Excel 导出**

使用 `xlsx` 建立工作表，第一行写标题并合并，第二行写年月/车间/工序，随后写两层表头：固定列各合并两行，动态列归入“不合格统计”“缺陷原因”。导出文件名为 `生产质量日报表_YYYY-MM.xlsx`，选择单产线时附加产线代码。

- [ ] **Step 5: 运行前端测试与类型检查**

Run: `pnpm --filter @scan/web test -- QueryAnalysisPage.test.tsx quality-report-export.test.ts && pnpm --filter @scan/web typecheck`

Expected: PASS。

- [ ] **Step 6: 提交前端报表切片**

```bash
git add apps/web/src/query apps/web/src/styles.css
git commit -m "feat: add quality daily report query and export"
```

### Task 4: 全量验证、迁移核验与交付更新

**Files:**
- Modify: `.planning/REQUIREMENTS.md`
- Modify: `.planning/ROADMAP.md`
- Modify: `.planning/STATE.md`
- Modify: `docs/pcr/PCR-20260713-production-quality-daily-report.md`

- [ ] **Step 1: 执行完整自动化验证**

Run: `pnpm db:validate && pnpm typecheck && pnpm lint && pnpm test && pnpm build`

Expected: 全部通过。

- [ ] **Step 2: 在独立临时 SQLite 数据库验证迁移**

Run: `DATABASE_URL=file:./quality-report-verify.db pnpm --filter @scan/api exec prisma migrate deploy`

Expected: 新迁移成功应用，`InspectionRecord` 存在 `productName`、`partName`，既有 `vehicleModel` 值可转存。

- [ ] **Step 3: 浏览器验收**

以查询用户登录本地完整系统，进入“查询分析 / 质量日报”，依次验证：默认年月、按产线查询、完整动态原因列、横向滚动、空结果、导出按钮和检查员无权访问。截图核对“部件”文字、表头对齐和无额外说明区。

- [ ] **Step 4: 更新状态与 PCR 验证结果**

在状态、路线图、需求和 PCR 中记录已完成的范围、实际迁移名、自动化命令结果、浏览器验收结论、Windows 更新时必须备份 `C:\\scan\\data\\scan.db` 且不得使用 `-SkipDatabase`。

- [ ] **Step 5: 提交验证与文档**

```bash
git add docs/pcr/PCR-20260713-production-quality-daily-report.md
git commit -m "docs: verify production quality daily report"
```

## Plan Self-Review

- 规格覆盖：查询、首检归属、跨月、人工更正、全部原因列、车型/部件字段、历史迁移、权限、Excel、浏览器验收均有对应任务。
- 类型一致性：日报行统一以 `partName` 表示“部件”，以 `defectCounts` 传递动态列，导出和页面共用 `QualityDailyReportResponse`。
- 非目标：未增加车间/工序主数据、班次、外部回写或猜测性数据回填。
