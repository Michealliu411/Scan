# SQLite 每日在线备份 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Windows Server 上每天 02:00 对运行中的 SQLite 生产库生成一致性备份至 `C:\backup`，不停止业务服务。

**Architecture:** 部署脚本生成独立的 PowerShell 在线备份脚本，并注册 `ScanDatabaseBackup` Windows 计划任务。备份脚本从既有 `.env` 读取数据库 URL，通过 Prisma CLI 执行 SQLite `VACUUM INTO`，以临时文件加改名保证失败不产生正式残缺备份。

**Tech Stack:** PowerShell 5+, Windows Task Scheduler, Prisma CLI, SQLite `VACUUM INTO`.

## Global Constraints

- 备份目录固定为 `C:\backup`。
- 任务每天本机时间 02:00 运行，身份为 SYSTEM。
- 不停止或重启 `ScanApi`、`ScanWeb`。
- 默认保留 30 天，参数范围为 1 至 3650 天。
- 不复制活跃数据库文件，不使用 `Copy-Item` 作为每日在线备份机制。

---

### Task 1: 部署脚本的测试与备份脚本生成

**Files:**
- Create: `scripts/deploy-windows.tests.ps1`
- Modify: `scripts/deploy-windows.ps1`

**Interfaces:**
- Produces: `C:\scan\run-database-backup.ps1`，接受部署脚本写入的数据库 URL、备份目录和保留天数。

- [ ] **Step 1: 写失败测试**

在 `scripts/deploy-windows.tests.ps1` 断言部署脚本包含 `BackupRoot = "C:\backup"`、`BackupRetentionDays` 参数、`VACUUM INTO`、`ScanDatabaseBackup`、`New-ScheduledTaskTrigger -Daily -At "02:00"` 和 `SYSTEM` 主体。

- [ ] **Step 2: 运行失败测试**

Run: `pwsh -NoProfile -File scripts/deploy-windows.tests.ps1`

Expected: FAIL，提示缺少每日备份任务或在线备份 SQL。

- [ ] **Step 3: 实现最小部署改动**

增加部署参数、生成 `run-database-backup.ps1`、添加每日任务注册函数，并在 Install/Update 的任务注册阶段调用。脚本以 Prisma CLI `db execute --stdin` 运行 `VACUUM INTO`，使用 `.partial` 与正式文件改名，写入独立日志，清理过期 `scan-db-*.db`。

- [ ] **Step 4: 验证通过**

Run: `pwsh -NoProfile -File scripts/deploy-windows.tests.ps1`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add scripts/deploy-windows.ps1 scripts/deploy-windows.tests.ps1
git commit -m "feat: add daily online database backup task"
```

### Task 2: 打包与运行手册

**Files:**
- Modify: `scripts/package-windows.sh`
- Modify: `docs/WINDOWS_DEPLOYMENT.md`
- Create: `docs/pcr/PCR-20260713-daily-online-database-backup.md`

**Interfaces:**
- Consumes: `ScanDatabaseBackup`、`C:\backup`、`C:\scan\logs\database-backup.log`。

- [ ] **Step 1: 写失败测试**

扩展 `scripts/deploy-windows.tests.ps1`，断言打包 README 和 Windows 部署手册包含任务名、目录、手动执行和日志查询命令。

- [ ] **Step 2: 运行失败测试**

Run: `pwsh -NoProfile -File scripts/deploy-windows.tests.ps1`

Expected: FAIL，提示发布说明尚未覆盖每日在线备份。

- [ ] **Step 3: 实现最小文档和打包改动**

在包内 README、正式部署手册和 PCR 中写明备份目录、任务、保留策略、手动触发、日志检查及“该任务不停业务服务”的边界。

- [ ] **Step 4: 验证通过**

Run: `pwsh -NoProfile -File scripts/deploy-windows.tests.ps1`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add scripts/package-windows.sh docs/WINDOWS_DEPLOYMENT.md docs/pcr/PCR-20260713-daily-online-database-backup.md scripts/deploy-windows.tests.ps1
git commit -m "docs: document daily database backup operations"
```

### Task 3: 跨平台回归验证

**Files:**
- Modify: `.planning/REQUIREMENTS.md`
- Modify: `.planning/STATE.md`

- [ ] **Step 1: 运行部署脚本静态验证**

Run: `pwsh -NoProfile -File scripts/deploy-windows.tests.ps1`

Expected: PASS。

- [ ] **Step 2: 运行项目回归与构建**

Run: `pnpm test && pnpm build`

Expected: 全部通过；构建可保留现有主包体积警告。

- [ ] **Step 3: 更新状态并提交**

```bash
git add .planning/REQUIREMENTS.md .planning/STATE.md
git commit -m "docs: record daily backup delivery"
```
