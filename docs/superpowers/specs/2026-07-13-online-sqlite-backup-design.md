# SQLite 每日在线备份设计

## 目标

在不停止 `ScanApi`、`ScanWeb` 服务的前提下，每天 02:00 将现场 SQLite 数据库一致性备份至 `C:\backup`，并保留最近 30 天备份。

## 范围

- Windows 部署脚本在安装和更新时创建或更新 `ScanDatabaseBackup` 计划任务。
- 计划任务以 `SYSTEM` 身份每天 02:00 执行在线数据库备份。
- 备份文件采用 `scan-db-yyyyMMdd-HHmmss.db` 命名，先写入同目录临时文件，成功后再原子改名。
- 每次成功备份后清理超过保留天数的本任务备份文件；默认 30 天，可由 `-BackupRetentionDays` 调整。
- 备份执行与结果记录到 `C:\scan\logs\database-backup.log`。

## 不在范围

- 不停止或重启业务服务。
- 不上传云端、不加密、不做跨机复制。
- 不清理更新前的 `C:\scan\backups` 人工/发布备份。
- 不改动业务数据模型和应用接口。

## 技术方案

不能直接复制正在写入的 `scan.db`，否则 WAL/事务期间可能得到不一致文件；停止服务后复制又不符合现场要求。计划任务调用仓库内 PowerShell 脚本，以 Prisma CLI 对当前 `DATABASE_URL` 执行 SQLite `VACUUM INTO`。该 SQLite 原生命令会在单个一致性快照中生成独立数据库，允许业务连接继续读写。

PowerShell 脚本读取 `C:\scan\Scan\.env` 中的 `DATABASE_URL`，验证其指向当前部署数据库；在 `C:\backup` 创建 `.partial` 文件，执行 SQL 后确认文件存在且大小大于零，再使用 `Move-Item` 改为正式 `.db`。失败时删除本次临时文件、写错误日志并返回非零退出码，既有备份不受影响。

部署脚本将备份任务注册为：

```text
任务名：ScanDatabaseBackup
触发：每天 02:00
身份：SYSTEM，最高权限
命令：powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\scan\run-database-backup.ps1
```

更新脚本不会停止该任务以外的业务服务；`ScanApi` 与 `ScanWeb` 维持运行。部署更新本身仍沿用既有“先停止服务、备份、迁移、重启”的安全流程。

## 验收标准

1. 安装或更新后存在 `ScanDatabaseBackup`，触发时间为每天 02:00，身份为 SYSTEM。
2. 手工执行任务时，`C:\backup` 生成可打开的 SQLite `.db` 文件，且业务服务不中断。
3. 当在线备份失败时，任务返回失败、日志记录原因、不留下正式空备份文件。
4. 仅清理超过保留天数的 `scan-db-*.db`，不影响其他文件和 `C:\scan\backups`。
5. 部署手册给出手工执行、查看任务、查看日志和修改保留天数的准确命令。

## 风险与控制

- `C:` 空间不足：任务失败但不影响在线业务；日志保留原因，管理员应监控系统盘空间。
- Prisma CLI 缺失或依赖损坏：任务失败并记录日志；正式发布时使用既有依赖安装与 Prisma 生成流程。
- 备份目录权限不足：SYSTEM 对 `C:\backup` 创建目录；失败返回非零并记录日志。
