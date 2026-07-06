# PCR-20260608-daily-plan-production-line-binding

## 1. 基本信息

- PCR 编号：PCR-20260608-daily-plan-production-line-binding
- 提出日期：2026-06-08
- 提出人：现场试运行反馈 / 项目负责人确认
- 变更类型：功能变更、数据模型变更、业务规则变更、权限与审计变更
- 影响模块：生产计划、检验扫描、操作日志、Windows 更新包
- 当前状态：已被后续 PCR `PCR-20260608-daily-plan-multi-line-allocation` 修订

## 2. 变更背景

现场反馈生产计划下达时不能继续默认使用登录产线，应由计划维护人员明确指定计划产线。同时，扫码时必须校验当前登录产线是否与该订单计划产线一致，避免 1 号线下达的订单在 2 号线被扫描入账。

项目负责人曾确认：不允许同一天同一个生产订单拆分到多条产线；一个订单只能下达到一个产线上。如需变更产线，应调整已下达计划的计划产线，并写入操作日志。

后续与客户充分沟通后，该规则已变更为“同一生产订单当天可以下达到多个产线，数量由用户自己控制”。以 `PCR-20260608-daily-plan-multi-line-allocation` 为当前有效规则。

## 3. 变更范围

- 生产计划下达时新增必选“计划产线”。
- 已下达且执行中的生产计划支持调整计划产线。
- 历史方案曾保持 `计划日期 + 生产订单号` 唯一规则，并禁止同一订单同一天下达到多条产线；该规则已被 `PCR-20260608-daily-plan-multi-line-allocation` 修订。
- 普通水洗条码扫码提交时校验当前登录产线与计划产线一致。
- 扫码解析成功后展示生产订单和日计划产线，方便现场人员判断当前订单归属。
- 计划产线变更和跨产线扫码拦截写入操作日志。
- 新增数据库迁移、后端 e2e 测试和前端组件测试。

## 4. 不在范围

- 历史方案不支持同一生产订单同一天拆分到多条产线；当前有效规则见 `PCR-20260608-daily-plan-multi-line-allocation`。
- 不改变检验员登录仍需选择当前工作产线的规则。
- 不改变特殊条码规则；污损条码和无条码产品仍按原特殊条码逻辑处理。
- 不新增产线审批、变更原因填写或多级审核。
- 不清空、不覆盖现场已有检验记录和生产计划。

## 5. 实施内容

- `DailyProductionPlan` 新增必填 `productionLineId`，关联 `ProductionLine`。
- 生产计划创建 DTO 要求传入 `productionLineId`，后端校验产线存在且启用。
- 生产计划更新接口支持同时调整今日计划数和计划产线。
- 计划创建、更新、关闭、重新打开、跨日复制返回计划产线信息。
- 跨日复制计划时保留原计划产线。
- 前端生产计划页面：
  - 下达计划前必须选择计划产线。
  - 计划列表显示并允许调整执行中计划的产线。
  - 已关闭计划仍禁用计划数和产线调整，需先重新打开。
- 扫码提交时：
  - 查找当天该生产订单唯一执行中计划。
  - 若计划产线与当前登录产线不一致，拒绝提交。
  - 拦截动作写入 `OperationLog`，动作名为 `SCAN_DAILY_PLAN_LINE_MISMATCH`。
- 扫码页面显示日计划状态、计划产线、合格完成数和剩余计划数。

## 6. 数据库与数据影响

本次涉及数据库结构迁移，但不删除、不清空现场数据。

- 新增迁移：`20260608131500_add_daily_plan_production_line`。
- 迁移给 `DailyProductionPlan` 增加必填 `productionLineId`。
- 现场已有生产计划会自动回填计划产线：
  - 优先取该计划已关联检验记录中最早一条记录的产线。
  - 若没有关联检验记录，则取当前启用产线中排序最靠前的一条。
  - 若没有启用产线，则取配置表中排序最靠前的一条。
- 既有 `InspectionRecord` 检验记录保留，不会被重建或删除。
- 历史方案唯一约束为 `businessDate + productionOrderNo`；当前有效规则已改为 `businessDate + productionOrderNo + productionLineId`。

## 7. 权限与审计影响

- 查询用户和管理员可以下达计划、调整计划数、调整计划产线、关闭计划、重新打开计划和跨日复制计划。
- 检验员不能进入生产计划维护页面。
- 计划产线调整写入 `OperationLog` 的 `UPDATE_DAILY_PLAN`，日志中记录变更前后的 `productionLineId` 和产线名称。
- 跨产线扫码拦截写入 `OperationLog` 的 `SCAN_DAILY_PLAN_LINE_MISMATCH`，日志中记录计划产线和当前扫码产线。

## 8. 验证结果

已执行：

- `pnpm --filter @scan/api db:generate`：通过，Prisma Client 已按最新 schema 生成。
- `pnpm --filter @scan/api test -- production-plans.e2e-spec.ts scanning.e2e-spec.ts`：通过，2 个测试套件，24 项。
- `pnpm --filter @scan/web test -- ProductionPlanPage.test.tsx InspectionScanningPage.test.tsx`：通过，9 个测试文件，62 项。
- `pnpm --filter @scan/api test`：通过，10 个测试套件，72 项。
- `pnpm --filter @scan/web test`：通过，9 个测试文件，62 项。
- `pnpm --filter @scan/api build`：通过。
- `VITE_API_BASE_URL=http://192.168.1.144:3000 pnpm --filter @scan/web build`：通过；Vite 大 chunk 提示为既有提示，不影响构建产物。
- `git diff --check`：通过。
- `DATABASE_URL=file:/private/tmp/scan-package-baseline.db pnpm --filter @scan/api exec prisma migrate deploy`：通过，基线库已应用 `20260608131500_add_daily_plan_production_line`。
- `SCAN_DB_PATH=/private/tmp/scan-package-baseline.db scripts/package-windows.sh`：通过，生成 Windows 更新包；最终交付包以本次交付说明为准。
- 更新包校验：zip 内包含本次迁移、`SCAN_DAILY_PLAN_LINE_MISMATCH`、`DAILY_PLAN_PRODUCTION_LINE_MISMATCH`、前端“计划产线/请选择产线”文案、`192.168.1.144:3000`、已更新的软件操作 HTML 手册和已应用本次迁移的 `ScanData/scan.db`。

## 9. 部署注意事项

- 本次更新包含数据库迁移，现场更新时不能使用 `-SkipDatabase`。
- 不使用 `-FreshDatabase`，避免覆盖现场 `C:\scan\data\scan.db`。
- 更新前建议确认 `C:\scan\data\scan.db` 已有备份；部署脚本也会在迁移前自动备份。
- 更新后，下达生产计划时必须选择计划产线。
- 更新后，普通水洗条码只能在计划产线对应的登录产线上扫码提交。
- 如需把已下达计划转到其他产线，应在生产计划列表中调整计划产线并保存。

## 10. 回滚方案

- 如仅回退程序代码，数据库中新增的 `productionLineId` 字段和迁移记录会保留。
- 如必须完全回滚数据库结构，应先停机，并使用更新前备份的 `scan.db` 恢复，不建议在现场库上手工删除字段或表。
- 若现场只是产线下达错误，不需要回滚系统，可由查询用户或管理员在生产计划列表中调整计划产线。
