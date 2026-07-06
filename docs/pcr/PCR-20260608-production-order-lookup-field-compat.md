# PCR-20260608-production-order-lookup-field-compat

## 1. 基本信息

- PCR 编号：PCR-20260608-production-order-lookup-field-compat
- 提出日期：2026-06-08
- 提出人：现场更新后生产计划查询反馈
- 变更类型：接口兼容修复、前端错误提示优化
- 影响模块：生产计划、生产订单接口解析、检验扫码订单解析
- 当前状态：已实现，待现场更新

## 2. 变更背景

现场在“生产计划”页面扫描产品标签查询订单时，页面显示 `Failed to fetch`。现场确认：

- 页面访问地址为 `http://192.168.1.144:8080`。
- 本系统 API 跨域预检正常。
- 外部生产订单解析接口 `http://192.168.1.151/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai` 可访问并返回 `ErrCode = 200`。

现场返回样例显示，外部接口将 `生产订单编号`、成品信息等字段直接放在响应根对象上，而不是放在原实现优先读取的 `JsonData` 对象内。

## 3. 变更范围

- 生产订单解析服务兼容外部接口根对象字段。
- 新增 `生产订单编号` 作为生产订单号候选字段。
- 新增 `生产订单数量` 作为订单数量候选字段。
- 保留原有 `JsonData` 内字段解析方式。
- 前端生产计划页将浏览器 `Failed to fetch` 转换为可操作提示。
- 补充后端和前端测试覆盖。

## 4. 不在范围

- 不变更数据库结构。
- 不变更生产计划业务规则。
- 不变更扫码计划拦截逻辑。
- 不变更外部接口地址。
- 不新增部署脚本参数。

## 5. 实施内容

- 后端 `ProductionOrderScanLookupService` 新增根对象解析路径：当 `JsonData` 不存在时，直接从响应根对象读取字段。
- 订单号字段新增兼容：`生产订单编号`。
- 订单数量字段新增兼容：`生产订单数量`，覆盖现场接口 `JsonData.生产订单数量 = 280` 的返回结构。
- `rawData` 保留实际用于解析的数据对象，便于后续追溯。
- 前端 `ProductionPlanPage` 对 `TypeError: Failed to fetch` 显示明确提示：
  - 当前页面需使用 `192.168.1.144:8080` 打开。
  - 检查 API 服务是否正常。

## 6. 数据库与数据影响

本次不涉及数据库迁移。

- 不修改 `scan.db` 结构。
- 不清空、不覆盖现场数据。
- 不影响已下达生产计划和已有检验记录。

## 7. 权限与审计影响

无权限变更。

生产计划查询成功后，仍按既有流程缓存订单信息；计划下达、调整、关闭和扫码拦截仍按既有操作日志规则记录。

## 8. 验证结果

已执行：

- `pnpm --filter @scan/api test -- production-order-scan-lookup.service.spec.ts`：通过，5 项。
- `pnpm --filter @scan/api test -- production-plans.e2e-spec.ts`：通过，5 项。
- `pnpm --filter @scan/web test -- ProductionPlanPage.test.tsx`：通过，9 个测试文件，61 项。
- `pnpm --filter @scan/api test`：通过，10 个测试文件，70 项。
- `pnpm --filter @scan/api build`：通过。
- `VITE_API_BASE_URL=http://192.168.1.144:3000 pnpm --filter @scan/web build`：通过；Vite 大 chunk 提示为既有提示，不影响构建。

## 9. 部署注意事项

本次不需要执行数据库迁移。

推荐现场更新命令：

```powershell
cd C:\scan\Scan
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144" -SkipInstall -SkipDatabase
```

说明：

- 不加 `-SkipBuild`，由现场脚本重新构建前端，确保 API 地址写入为 `http://192.168.1.144:3000`。
- 可加 `-SkipDatabase`，因为本次没有 schema 迁移。
- 不使用 `-FreshDatabase`。

## 10. 回滚方案

如现场仍无法查询订单，可回退到上一版本程序包；数据库不需要回滚。

若仅前端显示异常，应先强制刷新浏览器或清理缓存，再判断是否需要回退。
