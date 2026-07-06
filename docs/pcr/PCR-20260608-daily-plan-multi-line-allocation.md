# PCR-20260608-daily-plan-multi-line-allocation

## 1. 基本信息

- PCR 编号：PCR-20260608-daily-plan-multi-line-allocation
- 提出日期：2026-06-08
- 提出人：客户沟通确认 / 项目负责人确认
- 变更类型：业务规则变更、数据模型变更、扫码校验变更、文档变更
- 影响模块：生产计划、检验扫描、订单完成查询、操作手册、Windows 更新包
- 当前状态：已实现，已本地验证，待现场更新

## 2. 变更背景

原实现按“一张生产订单当天只能下达到一条产线”处理。与客户进一步沟通后，现场存在同一生产订单当天分配到多条产线生产的情况，且每条产线的计划数量由业务人员自行拆分和控制。

因此需要将唯一规则调整为“同一日期、同一生产订单、同一产线只能有一条计划”，允许同一生产订单当天下达到多条产线。

## 3. 变更范围

- 数据库唯一约束从 `businessDate + productionOrderNo` 调整为 `businessDate + productionOrderNo + productionLineId`。
- 生产计划下达允许同一订单同一天在不同产线各建一条计划。
- 同一订单同一天同一产线重复下达仍拦截。
- 今日计划数只校验正整数，不再要求小于或等于订单数量。
- 调整计划产线时，如果目标产线已存在同订单当天计划，则拒绝保存。
- 扫码提交时按“当前登录产线 + 当天生产订单”查找计划，并绑定到该产线对应的计划。
- 跨日复制按每条产线计划分别复制，只跳过目标日期已存在的同订单同产线计划。
- 操作手册和截图版 HTML 手册同步更新多产线规则。

## 4. 不在范围

- 不自动校验同一订单多条产线计划数量合计是否超过订单数量。
- 不做多产线计划自动拆分、自动合并或自动平衡。
- 不新增计划合并功能；若同订单同产线重复，应由用户调整已有计划。
- 不改变特殊条码、合格条码唯一、检验员登录产线等既有规则。

## 5. 实施内容

- 新增迁移 `20260608134500_allow_daily_plan_multi_line`，删除旧唯一索引并创建三字段唯一索引。
- 更新 Prisma schema 的 `DailyProductionPlan` 唯一约束。
- 更新生产计划服务：
  - 创建计划时只检查同日期、同订单、同产线是否已存在。
  - 更新产线时检查目标产线是否已有同订单当天计划。
  - 跨日复制按同订单同产线判断跳过。
  - 移除今日计划数不能大于订单数量的后端限制。
- 更新扫码服务：
  - 查找当前登录产线对应的订单计划。
  - 同订单存在其他产线计划但当前产线没有计划时，按跨产线扫码拦截处理。
  - 扫码记录绑定到当前产线对应的 `dailyProductionPlanId`。
- 更新前端生产计划页面，移除计划数输入框的订单数量上限属性。
- 更新操作手册、用户手册和截图版 HTML 手册。

## 6. 数据库与数据影响

本次涉及数据库索引迁移，不删除业务数据。

- 现场已有生产计划记录保留。
- 现场已有检验记录保留。
- 新唯一索引允许同一订单同一天在不同产线各有一条计划。
- 迁移前若现场已有同日期、同订单、同产线重复记录，新唯一索引会失败；按当前系统旧唯一规则，现场正常不应存在这种重复。
- 订单完成查询会按计划记录展示，多产线计划会显示为多行。

## 7. 权限与审计影响

- 权限不变：查询用户和管理员维护生产计划，检验员扫码。
- 计划创建、调整、关闭、重新打开、复制仍写入操作日志。
- 跨产线扫码拦截继续写入 `SCAN_DAILY_PLAN_LINE_MISMATCH`。
- 调整产线时，若目标产线已有同订单当天计划，会返回 `DAILY_PLAN_ALREADY_EXISTS`。

## 8. 验证结果

已执行：

- `pnpm --filter @scan/api db:generate`：通过，Prisma Client 已按三字段唯一约束生成。
- `pnpm --filter @scan/api test -- production-plans.e2e-spec.ts scanning.e2e-spec.ts`：先红灯失败，确认旧规则阻止同订单多产线计划；实现后通过，2 个测试套件，26 项。
- `pnpm --filter @scan/web test -- ProductionPlanPage.test.tsx InspectionScanningPage.test.tsx QueryAnalysisPage.test.tsx`：通过，9 个测试文件，62 项。
- `pnpm --filter @scan/api test`：通过，10 个测试套件，74 项。
- `pnpm --filter @scan/web test`：通过，9 个测试文件，62 项。
- `pnpm --filter @scan/api build`：通过。
- `VITE_API_BASE_URL=http://192.168.1.144:3000 pnpm --filter @scan/web build`：通过；Vite 大 chunk 提示为既有提示，不影响构建产物。
- `git diff --check`：通过。
- `DATABASE_URL=file:/private/tmp/scan-package-baseline.db pnpm --filter @scan/api exec prisma migrate deploy`：通过，基线库已应用 `20260608134500_allow_daily_plan_multi_line`。
- `SCAN_DB_PATH=/private/tmp/scan-package-baseline.db scripts/package-windows.sh`：通过，生成 Windows 更新包；最终交付包以本次交付说明为准。
- 更新包校验：zip 内包含新迁移、三字段唯一索引、`businessDate_productionOrderNo_productionLineId` 查询逻辑、`192.168.1.144:3000`、新 PCR 和更新后的 HTML 手册；`ScanData/scan.db` 已包含本次迁移记录。

## 9. 部署注意事项

- 本次包含数据库迁移，现场更新不能使用 `-SkipDatabase`。
- 不使用 `-FreshDatabase`，避免覆盖现场 `C:\scan\data\scan.db`。
- 更新前建议确认 `C:\scan\data\scan.db` 已有备份；部署脚本会在迁移前自动备份。
- 更新后，同一订单可以按不同计划产线分别下达；同订单同产线重复下达会被系统拦截。
- 计划数量和多产线合计数量由业务人员自行控制。

## 10. 回滚方案

- 如仅回退程序代码，数据库中的三字段唯一索引会保留。
- 如必须完全回滚数据库结构，应先停机，并使用更新前备份的 `scan.db` 恢复。
- 若现场只是计划数量分配错误，不需要回滚系统，可在生产计划列表中调整对应产线的计划数。
