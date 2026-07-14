# PCR-20260713-daily-online-database-backup

## 1. 基本信息

- PCR 编号：PCR-20260713-daily-online-database-backup
- 提出日期：2026-07-13
- 提出人：生产现场 / 系统运维
- 变更类型：运维可靠性增强
- 影响模块：Windows 部署脚本、计划任务、发布包、部署手册
- 当前状态：本地验证完成，待 Windows Server 手工验收

## 2. 变更背景

现场 SQLite 数据库集中保存生产扫码和质量记录，需要建立独立于人工更新的每日恢复点，同时不能为了备份中断现场扫码。

## 3. 实施内容

- 新增 `ScanDatabaseBackup` Windows 计划任务，每天 02:00 以 SYSTEM 身份运行。
- 采用 SQLite `VACUUM INTO` 在线生成一致性数据库副本，不直接复制活动 `scan.db`。
- 备份落在 `C:\backup`，默认保留 30 天，支持部署参数调整。
- 先写入 `.partial` 文件、校验非空后改名；失败删除临时文件并写入 `C:\scan\logs\database-backup.log`。

## 4. 数据与服务影响

不修改数据库结构和业务数据，不停止、不重启 `ScanApi` 或 `ScanWeb`。备份失败不影响在线业务；成功备份为可独立恢复的 SQLite 文件。

## 5. 验收标准

- 安装/更新后任务存在，计划时间为 02:00，运行账号为 SYSTEM。
- 手工启动任务后 `C:\backup` 产生可读备份库。
- 保留策略仅清理过期的 `scan-db-*.db`。
- 部署手册含手工运行、任务状态、日志和保留天数调整命令。

## 6. 部署注意事项

本次为脚本和任务注册变更，更新时不要使用 `-SkipTasks`，否则不会创建或更新每日备份任务。常规应用更新前的 `C:\scan\backups` 备份策略保持不变。已有现场服务器必须使用 `SCAN_PACKAGE_MODE=update` 生成的无数据库更新包；该包不含 `ScanData` 或 `scan.db`，部署脚本只备份并迁移现场 `C:\scan\data\scan.db`。

## 7. 回滚方案

可回退至上一版部署脚本并取消任务：

```powershell
Unregister-ScheduledTask -TaskName ScanDatabaseBackup -Confirm:$false
```

已生成的 `C:\backup\scan-db-*.db` 不自动删除，可作为历史恢复点保留或由管理员按需清理。

## 8. 验证结果

- 部署脚本契约测试验证了任务名、02:00 触发、SYSTEM 身份、`VACUUM INTO`、临时文件、日志、保留清理及发布文档命令。
- 已使用 Prisma CLI 对独立临时 SQLite 库执行 `VACUUM INTO`，并从生成库读取到原始数据。
- 全量 API/前端测试（10 个 API 测试套件共 76 项、9 个前端测试文件共 64 项）及生产构建通过。
- 本机未安装 Windows PowerShell/任务计划程序；发布后须按手册手工启动一次 `ScanDatabaseBackup` 并确认 `C:\backup` 与日志结果。

## 9. 现场故障修复记录

2026-07-14 首次现场运行显示任务已注册但退出码为 1，日志仅记录 Prisma 命令失败。原因是计划任务在 SYSTEM 环境中不能可靠使用管理员账户可见的全局 `pnpm`。已改为直接调用项目本地 `apps\api\node_modules\.bin\prisma.cmd`，并将 Prisma 标准输出和错误逐行写入备份日志。修复后的更新包仍不包含任何数据库文件；现场需重新更新后手工执行任务验收。
