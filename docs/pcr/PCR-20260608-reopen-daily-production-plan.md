# PCR-20260608-reopen-daily-production-plan

## 1. 基本信息

- PCR 编号：PCR-20260608-reopen-daily-production-plan
- 提出日期：2026-06-08
- 提出人：现场试运行反馈
- 变更类型：缺陷修复、业务行为变更、权限与审计变更
- 影响模块：生产计划、操作日志、Windows 更新包
- 当前状态：已实现，已本地验证，待现场更新

## 2. 变更背景

现场反馈：已经下达的生产日计划在手动关闭后，页面没有重新打开入口。若现场误关闭计划，后续只能重新下达其他计划或等待处理，影响当天扫码生产。

既有需求已支持“关闭计划”，但未明确关闭后的恢复操作。本次补齐“已关闭计划可重新打开”的闭环。

## 3. 变更范围

- 后端生产计划接口新增重新打开动作。
- 前端生产计划列表对已关闭计划显示“重新打开”按钮。
- 重新打开后恢复为“执行中”，清空 `closedAt`。
- 重新打开动作写入操作日志。
- 补充后端 e2e 测试和前端组件测试。
- 重新生成 Windows 更新包。

## 4. 不在范围

- 不新增或修改数据库表结构。
- 不删除、不重建、不清空现场已有生产计划和检验记录。
- 不变更计划下达、计划复制、扫码拦截和订单完成统计口径。
- 不新增多级审批或关闭原因管理。
- 不允许已关闭计划直接编辑；必须先重新打开，再调整计划数。

## 5. 实施内容

- 后端新增 `POST /production-plans/:id/reopen`。
- 已关闭计划调用重新打开后更新为 `ACTIVE`，并将 `closedAt` 置空。
- 已是执行中的计划重复调用重新打开时保持幂等返回，不重复写审计。
- 操作日志新增动作 `REOPEN_DAILY_PLAN`，记录重新打开前后的计划状态。
- 前端生产计划列表中：
  - 执行中计划显示“保存”和“关闭”。
  - 已关闭计划仍禁用计划数输入和“保存”。
  - 已关闭计划显示可点击“重新打开”。
- 前端重新打开成功后按当前筛选条件刷新列表。

## 6. 数据库与数据影响

本次不涉及数据库结构迁移。

- 不修改 `scan.db` schema。
- 不覆盖现场已有数据。
- 已关闭的历史生产计划可以通过新按钮恢复为执行中。
- 已有关联检验记录、合格数、不合格数和剩余计划统计保留原口径。

## 7. 权限与审计影响

- 查询用户和管理员可以重新打开计划，权限与关闭计划保持一致。
- 检验员不能进入生产计划管理接口。
- 重新打开写入 `OperationLog`，动作名为 `REOPEN_DAILY_PLAN`，目标为生产订单号。

## 8. 验证结果

已执行：

- `pnpm --filter @scan/api test -- production-plans.e2e-spec.ts`：通过，6 项。
- `pnpm --filter @scan/web test -- ProductionPlanPage.test.tsx`：通过，9 个测试文件，62 项。
- `pnpm --filter @scan/api test`：通过，10 个测试套件，71 项。
- `pnpm --filter @scan/web test`：通过，9 个测试文件，62 项。
- `pnpm --filter @scan/api build`：通过。
- `VITE_API_BASE_URL=http://192.168.1.144:3000 pnpm --filter @scan/web build`：通过；Vite 大 chunk 提示为既有提示，不影响构建产物。
- `git diff --check`：通过。
- `SCAN_DB_PATH=/private/tmp/scan-package-baseline.db scripts/package-windows.sh`：通过，生成 `releases/scan-windows-20260608-105601.zip`。
- 更新包校验：zip 内包含 `/production-plans/:id/reopen`、`REOPEN_DAILY_PLAN`、前端“重新打开”按钮、`192.168.1.144:3000` 和 `ScanData/scan.db`。

## 9. 部署注意事项

本次变更本身不需要新增数据库迁移，但现场仍应按标准更新流程执行，确保之前生产计划相关迁移已在现场库上应用。

推荐现场更新命令：

```powershell
cd C:\scan\Scan
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144" -SkipInstall
```

说明：

- 不使用 `-FreshDatabase`，避免覆盖现场数据。
- 不建议加 `-SkipDatabase`，除非已经确认现场 `C:\scan\data\scan.db` 完成生产计划迁移。
- 更新脚本会在迁移前备份数据库，并在更新后重启服务。

## 10. 回滚方案

- 如重新打开功能异常，可回退到上一版本程序包；数据库不需要回滚。
- 如回退后仍保留已重新打开的数据，计划状态会继续以数据库中当前状态为准。
- 如现场需要恢复某个计划关闭状态，可在回退前先从页面再次关闭该计划。
