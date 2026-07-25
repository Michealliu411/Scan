# 生产订单日计划与完成监督操作手册

## 1. 适用范围

本文档适用于 `Scan` 项目本次“生产订单日计划与完成监督”变更后的现场更新、日常操作和常见故障处理。

现场服务器固定信息：

- Web 访问地址：`http://192.168.1.144:8080`
- API 地址：`http://192.168.1.144:3000`
- 程序目录：`C:\scan\Scan`
- 现场数据库：`C:\scan\data\scan.db`
- 日志目录：`C:\scan\logs`
- 数据库备份目录：`C:\scan\backups`
- Windows 计划任务：`ScanApi`、`ScanWeb`

## 2. 本次变更内容

本次变更新增三类能力：

1. 生产计划下达：查询用户和管理员可以按“日期 + 生产订单 + 计划产线”下达日计划。
2. 扫码完成监督：普通产品标签扫码时，系统会校验当天是否有有效生产计划、当前登录产线是否等于计划产线，并按合格数控制计划完成。
3. 订单完成查询：查询分析中新增订单完成视图，可查看日计划数、合格数、不合格数、剩余数和完成率。

本次数据库为增量迁移，不删除、不清空现场历史数据。历史检验记录保留，仍可在原有明细和看板中查询；没有生产订单绑定的旧记录不会计入新的订单完成统计。

## 3. 现场更新步骤

### 3.1 更新前准备

1. 将新的 `scan-windows-*.zip` 更新包复制到服务器。
2. 打开“管理员 PowerShell”。
3. 解压新包到 `C:\scan`，覆盖其中的 `C:\scan\Scan` 程序目录。不要手工单独停止或启动某一个计划任务；后续部署命令会统一停止两个任务、清理残留 Node 进程并一起重启。

注意：不要删除 `C:\scan\data`、`C:\scan\logs`、`C:\scan\backups`。

### 3.2 正确更新命令

本次变更包含前端页面变化和数据库结构变化，现场更新必须执行构建和数据库迁移。

进入程序目录：

```powershell
cd C:\scan\Scan
Set-ExecutionPolicy -Scope Process Bypass
```

执行更新：

```powershell
.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144" -SkipInstall
```

本次更新不要使用以下参数：

```powershell
-SkipBuild
-SkipDatabase
-FreshDatabase
```

原因：

- 不加 `-SkipBuild`：前端需要重新构建，并写入正确 API 地址 `http://192.168.1.144:3000`。
- 不加 `-SkipDatabase`：本次新增生产计划表和检验记录关联字段，需要执行数据库迁移。
- 不加 `-FreshDatabase`：该参数会替换现场数据库，不适合保留历史数据的更新。

### 3.3 脚本自动执行内容

更新脚本会自动执行：

1. 停止 `ScanApi` 和 `ScanWeb`。
2. 停止本项目相关 `node.exe` 进程。
3. 备份 `C:\scan\data\scan.db` 到 `C:\scan\backups`。
4. 写入 `.env`、`apps\api\.env`、`apps\web\.env`。
5. 执行 `pnpm db:generate`。
6. 执行 `prisma migrate deploy`。
7. 执行 `pnpm db:validate`。
8. 构建 API 和 Web。
9. 重建并启动 Windows 计划任务。
10. 执行健康检查。

### 3.4 更新后验证

在服务器 PowerShell 中执行：

```powershell
Invoke-WebRequest http://192.168.1.144:3000/production-lines -UseBasicParsing
```

正常结果应返回类似：

```json
[{"id":"line-01","code":"LINE-01","name":"产线01"}]
```

确认前端包写入了正确 API 地址：

```powershell
Select-String -Path C:\scan\Scan\apps\web\dist\assets\*.js -Pattern "192.168.1.144:3000" -SimpleMatch
```

浏览器访问：

```text
http://192.168.1.144:8080
```

如果浏览器仍显示旧页面或报旧 JS 错误，按 `Ctrl + F5` 强制刷新，或使用无痕窗口重新打开。

## 4. 生产计划下达操作

### 4.1 登录

使用查询用户或管理员登录系统。

查询用户和管理员可以进入“生产计划”模块；检验员不能进入该模块。

### 4.2 查询生产订单

1. 打开“生产计划”。
2. 在“下达日计划”区域选择“计划产线”。
3. 扫描或输入产品标签。
4. 点击“查询订单”。
5. 系统调用外部接口解析订单信息。

当前订单解析接口：

```text
http://192.168.1.151/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai
```

请求体：

```json
{ "Code": "扫描到的产品标签码" }
```

系统会读取：

- 成品零件编号
- 成品产品名称
- 生产订单号、生产订单、订单号或工单号
- 订单数量、生产数量或数量

如果接口没有返回生产订单号或订单数量，系统会提示生产订单信息不完整，不能下达计划。

### 4.3 下达日计划

查询成功后，页面会显示：

- 计划产线
- 生产订单
- 零件号
- 产品名称
- 订单数量

确认“计划产线”，填写“今日计划数”，点击“下达计划”。

规则：

- 同一天同一个生产订单可以下达到多条产线。
- 同一天同一个生产订单在同一条产线上只能有一条计划。
- 计划产线必填，不能默认使用登录产线代替。
- 今日计划数必须是正整数。
- 今日计划数和多产线合计数量由用户自己控制；订单数量只作为参考。
- 下达计划会写入操作记录。

### 4.4 调整计划数或计划产线

在“生产计划列表”中修改“今日计划”输入框，或修改该行“产线”下拉框，然后点击“保存”。

规则：

- 已关闭计划不能修改。
- 修改计划数或计划产线会写入操作记录。
- 如果当前合格数已经达到或超过新计划数，后续合格扫码会被拦截。
- 如果调整产线时目标产线已经存在同订单当天计划，系统会阻止保存，需要直接调整目标产线那条计划。

### 4.5 关闭计划

在“生产计划列表”中点击“关闭”。

规则：

- 关闭后该订单不再允许按该计划继续合格扫码。
- 关闭操作会写入操作记录。
- 已关闭计划仍可在列表和订单完成查询中查看。

### 4.6 跨日复制

在“跨日复制”区域选择：

- 来源日期
- 目标日期

点击“复制计划”。

规则：

- 只复制来源日期中仍为执行中的计划。
- 目标日期已存在同生产订单、同产线计划时会跳过。
- 复制后会保留原计划产线；如目标日期实际生产产线不同，可在目标日期计划列表中调整产线并保存。

## 5. 检验扫码操作变化

### 5.1 普通产品标签扫码

检验员登录并选择产线后，进入“检验扫描”。

普通产品标签扫码时，系统会：

1. 调用外部订单解析接口。
2. 解析零件号、车型、生产订单。
3. 查找当天同生产订单的有效日计划。
4. 校验当前登录产线是否等于该订单计划产线。
5. 显示日计划状态和计划产线。
6. 按计划规则提交检验记录。

扫码页会显示：

- 零件号
- 车型
- 生产订单
- 日计划状态
- 计划产线
- 已完成合格数 / 计划数
- 剩余数

### 5.2 计划拦截规则

普通产品标签扫码会按以下规则拦截：

- 没有解析到生产订单号：不能按计划提交。
- 当天没有该生产订单的执行中计划：拦截。
- 该生产订单计划已关闭：拦截。
- 当前登录产线不是该订单计划产线：拦截。
- 合格数已达到今日计划数：继续合格扫码会被拦截。

拦截会写入操作记录，方便后续追溯。

### 5.3 合格和不合格计数

- 合格记录计入计划完成数。
- 不合格记录保留在检验明细中，但不占用计划合格完成数。
- 订单完成中的“不合格数”用于查看该计划下产生的不合格记录。

### 5.4 特殊条码不受本次计划规则影响

污损条码、无条码产品等特殊条码仍按原有特殊条码规则处理，不走普通生产订单日计划拦截。

## 6. 订单完成查询

查询用户或管理员进入“查询分析”，打开“订单完成”标签页。

可按以下条件查询：

- 计划日期
- 状态：全部、执行中、已关闭
- 生产订单

结果字段：

- 状态
- 生产订单
- 产品
- 订单数量
- 日计划数
- 合格数
- 不合格数
- 剩余数
- 完成率
- 产线

点击“导出Excel”可导出 `订单完成.xlsx`。

## 7. 操作记录查看

进入“查询分析”的“操作记录”标签页，可查看与本次变更相关的记录。

重点关注：

- 生产计划创建
- 生产计划调整
- 生产计划关闭
- 跨日复制计划
- 因无日计划被扫码拦截
- 因登录产线与计划产线不一致被扫码拦截
- 因计划完成被扫码拦截

## 8. 常见问题处理

### 8.1 浏览器输入 `192.168.1.144` 打不开

Web 服务端口是 `8080`，正确访问地址是：

```text
http://192.168.1.144:8080
```

裸 IP 不带端口通常打不开。

### 8.2 PowerShell 窗口闪一下就没了

不要双击脚本运行。

应打开“管理员 PowerShell”，手工执行：

```powershell
cd C:\scan\Scan
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144" -SkipInstall
```

### 8.3 登录页报 `some is not a function`

原因通常是前端没有重新构建，导致前端请求打到了 `8080` Web 服务，而不是 `3000` API 服务。

检查 API 是否正常：

```powershell
Invoke-WebRequest http://192.168.1.144:3000/production-lines -UseBasicParsing
```

检查前端包是否包含正确 API 地址：

```powershell
Select-String -Path C:\scan\Scan\apps\web\dist\assets\*.js -Pattern "192.168.1.144:3000" -SimpleMatch
```

如果搜不到 `192.168.1.144:3000`，重新执行更新命令，且不要加 `-SkipBuild`：

```powershell
.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144" -SkipInstall
```

如果已经能搜到，但浏览器仍报旧 JS 文件名，按 `Ctrl + F5` 强制刷新，或清理浏览器缓存。

### 8.4 API 正常但页面打不开

检查 Web 任务和日志：

```powershell
Get-ScheduledTaskInfo ScanWeb
Get-Content C:\scan\logs\web.log -Tail 80
```

按统一规则重启 API 和 Web：

```powershell
cd C:\scan\Scan
.\scripts\deploy-windows.ps1 -Mode Restart -ServerIp "192.168.1.144"
```

### 8.5 页面能打开但扫码接口异常

检查 API 日志：

```powershell
Get-Content C:\scan\logs\api.log -Tail 80
```

确认外部订单解析接口可访问：

```powershell
Invoke-WebRequest http://192.168.1.151/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai -UseBasicParsing
```

如果接口本身不可访问，生产计划查询和普通扫码解析都会受到影响。

### 8.6 数据库迁移失败

先不要删除数据库。

查看日志：

```powershell
Get-Content C:\scan\logs\migrate-deploy.log -Tail 120
```

确认最近一次备份：

```powershell
Get-ChildItem C:\scan\backups | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

如需回退，应优先使用 `C:\scan\backups` 中的备份库恢复，不建议手工删除新增表或字段。

## 9. 日常维护命令

标准重启命令：

```powershell
cd C:\scan\Scan
.\scripts\deploy-windows.ps1 -Mode Restart -ServerIp "192.168.1.144"
```

该命令会停止 `ScanApi` 和 `ScanWeb`、结束本项目残留 Node 进程，确认 3000、8080 端口释放后再一起启动两个任务。API 和 Web 必须在 30 秒内通过健康检查，否则脚本会报错退出，不能视为重启成功。禁止将单独执行 `Stop-ScheduledTask`、`Start-ScheduledTask` 作为标准重启方法。

查看任务状态：

```powershell
Get-ScheduledTaskInfo ScanApi
Get-ScheduledTaskInfo ScanWeb
```

查看 API 日志：

```powershell
Get-Content C:\scan\logs\api.log -Tail 80
```

查看 Web 日志：

```powershell
Get-Content C:\scan\logs\web.log -Tail 80
```

## 10. 更新命令选择规则

本项目现场服务器 IP 固定为 `192.168.1.144`。

本次变更以及后续类似变更，默认使用：

```powershell
.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144" -SkipInstall
```

只有同时满足以下条件时，才考虑增加 `-SkipBuild` 或 `-SkipDatabase`：

- 没有前端页面变化。
- 没有 API 地址、端口、环境变量变化。
- 没有数据库 schema 变化。
- 没有 Prisma 迁移变化。
- 已确认当前构建产物就是要部署的版本。

如果不确定，宁可不加 `-SkipBuild` 和 `-SkipDatabase`。

禁止在现场保留数据更新中使用：

```powershell
-FreshDatabase
```

## 11. 本次问题复盘

本次现场出现过登录页报错：

```text
Uncaught TypeError: w.some is not a function
```

原因是第一次更新命令带了 `-SkipBuild`，前端没有按现场服务器 IP 重新构建，导致浏览器请求 `/production-lines` 时打到了 Web 端口 `8080`，拿到的不是 API 返回的产线数组。

正确处理方式：

1. 重新执行更新命令，去掉 `-SkipBuild`：

```powershell
.\scripts\deploy-windows.ps1 -Mode Update -ServerIp "192.168.1.144" -SkipInstall
```

2. 确认前端 bundle 包含 API 地址：

```powershell
Select-String -Path C:\scan\Scan\apps\web\dist\assets\*.js -Pattern "192.168.1.144:3000" -SimpleMatch
```

3. 浏览器按 `Ctrl + F5` 强制刷新。

以后遇到前端访问 API 异常，优先检查前端 bundle 中是否包含 `192.168.1.144:3000`。
