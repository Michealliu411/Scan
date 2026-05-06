---
phase: 01-foundation-auth-and-data-model
plan: 01-01
subsystem: infra
tags: [pnpm, monorepo, nestjs, react, vite, typescript, vitest, jest]
requires: []
provides:
  - pnpm workspace with apps/web and apps/api packages
  - NestJS API skeleton with credentialed CORS, cookie parsing, and health endpoint
  - React TypeScript Vite web skeleton with baseline styling and smoke test
  - shared strict TypeScript configuration and locked dependencies
affects: [phase-01, api, web, tooling]
tech-stack:
  added: [pnpm, NestJS, React, Vite, Jest, Vitest, Testing Library, Prisma client, argon2, lucide-react]
  patterns:
    - root workspace scripts delegate to package-specific commands
    - API uses NestJS module/controller/service structure
    - web app uses Vite entrypoint with UI-spec CSS variables
key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - tsconfig.base.json
    - .env.example
    - pnpm-lock.yaml
    - apps/api/package.json
    - apps/api/src/main.ts
    - apps/api/src/app.module.ts
    - apps/api/src/app.controller.ts
    - apps/api/src/app.service.ts
    - apps/api/test/app.e2e-spec.ts
    - apps/web/package.json
    - apps/web/src/App.tsx
    - apps/web/src/App.test.tsx
    - apps/web/src/styles.css
  modified:
    - .gitignore
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
key-decisions:
  - "Use pnpm workspaces with apps/* as the monorepo package boundary."
  - "Use NestJS ConfigModule globally so later auth, Prisma, and module slices share environment access."
  - "Commit the pnpm lockfile to make dependency resolution reproducible for later plans."
patterns-established:
  - "Root scripts fan out to @scan/api and @scan/web package scripts."
  - "API health checks are covered by Nest testing utilities and Supertest."
  - "Frontend shell styling starts from UI-SPEC light/dark CSS variables."
requirements-completed: [PLAT-02]
duration: 11 min
completed: 2026-05-06
---

# Phase 01 Plan 01-01: Monorepo Scaffold and Baseline Tooling Summary

**Pnpm monorepo foundation with NestJS health API, React/Vite web shell, shared TypeScript settings, and locked verification tooling**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-06T04:57:28Z
- **Completed:** 2026-05-06T05:08:44Z
- **Tasks:** 3 completed
- **Files modified:** 27

## Accomplishments

- Created the root pnpm workspace with required dev, build, test, typecheck, and database scripts.
- Added a NestJS API package with global config, credentialed CORS, signed cookie parsing, and `GET /health`.
- Added a React + TypeScript + Vite web package rendering `车间检验扫描统计系统` with UI-SPEC light/dark tokens.
- Installed and locked dependencies, then verified typecheck and tests.

## Task Commits

Each task was committed atomically:

1. **Task 01-01-01: Create root workspace and scripts** - `19567ad` (feat)
2. **Task 01-01-02: Create NestJS API skeleton** - `471d4cd` (feat)
3. **Task 01-01-03: Create React web skeleton** - `023c286` (feat)
4. **Verification support: Lock workspace dependencies** - `9e11982` (chore)

## Files Created/Modified

- `package.json` - Root workspace scripts for dev, build, test, typecheck, lint, and database commands.
- `pnpm-workspace.yaml` - Workspace package discovery for `apps/*`.
- `tsconfig.base.json` - Shared strict TypeScript defaults.
- `.env.example` - Development-safe environment keys for database, CORS, cookie, and session configuration.
- `.gitignore` - Keeps `.planning/`, `.env`, dependency output, logs, and TypeScript build info out of normal tracking.
- `pnpm-lock.yaml` - Reproducible dependency graph from `pnpm install`.
- `apps/api/package.json` - NestJS API package scripts and dependencies.
- `apps/api/src/main.ts` - API bootstrap with credentialed CORS and cookie parsing.
- `apps/api/src/app.module.ts` - Root Nest module with global `ConfigModule`.
- `apps/api/src/app.controller.ts` - Health endpoint controller.
- `apps/api/src/app.service.ts` - Health response service.
- `apps/api/jest.config.ts` - Jest/ts-jest configuration for API e2e tests.
- `apps/api/test/app.e2e-spec.ts` - `/health` status/body test.
- `apps/web/package.json` - React/Vite package scripts and dependencies.
- `apps/web/index.html` - Vite HTML entrypoint.
- `apps/web/tsconfig.json` - Web TypeScript configuration.
- `apps/web/vite.config.ts` - Vite React server configuration.
- `apps/web/vitest.config.ts` - Vitest jsdom configuration.
- `apps/web/src/main.tsx` - React app mount.
- `apps/web/src/App.tsx` - Initial app shell content.
- `apps/web/src/App.test.tsx` - Web smoke test for the system title.
- `apps/web/src/styles.css` - UI-SPEC color tokens, font stack, and base layout.

## Decisions Made

- Used pnpm workspaces exactly around `apps/*` to match the locked project structure.
- Kept the API skeleton module-oriented with controller/service/module files, leaving feature modules for subsequent plans.
- Added a web smoke test even though the plan did not list a test file, because the required `pnpm test` verification needs a concrete frontend assertion.
- Committed `pnpm-lock.yaml` because dependency resolution is part of the executable scaffold.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added frontend smoke test for test verification**
- **Found during:** Task 01-01-03 (Create React web skeleton)
- **Issue:** The plan required `pnpm test`, but the web package would otherwise have no Vitest test file.
- **Fix:** Added `apps/web/src/App.test.tsx` to verify the rendered system title.
- **Files modified:** `apps/web/src/App.test.tsx`
- **Verification:** `pnpm test` passed.
- **Committed in:** `023c286`

**2. [Rule 3 - Blocking] Committed lockfile and ignored TypeScript build info**
- **Found during:** Plan-level verification
- **Issue:** `pnpm install` generated `pnpm-lock.yaml`, and `pnpm typecheck` generated `apps/web/tsconfig.tsbuildinfo`.
- **Fix:** Committed `pnpm-lock.yaml`, added `*.tsbuildinfo` to `.gitignore`, and removed the generated build-info file.
- **Files modified:** `pnpm-lock.yaml`, `.gitignore`
- **Verification:** `git status --short` only showed the pre-existing untracked `AGENTS.md`.
- **Committed in:** `9e11982`

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking issues)
**Impact on plan:** No scope expansion beyond executable verification and generated artifact hygiene.

## Issues Encountered

- `pnpm install` initially failed in the sandbox because Corepack needed to write to the user cache; reran with approved escalation and installation completed.
- `pnpm test` initially failed in the sandbox because Supertest/Nest needed localhost socket binding; reran with approved escalation and all tests passed.

## Verification

- `pnpm install` - PASSED
- `pnpm typecheck` - PASSED
- `pnpm test` - PASSED with localhost binding approval

## Known Stubs

- `apps/web/src/App.tsx` renders `基础框架初始化中` intentionally; this exact placeholder is required by Plan 01-01 and will be replaced by later Phase 1 login/app-shell work.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: public-health-endpoint | `apps/api/src/app.controller.ts` | Adds unauthenticated `GET /health`; acceptable for scaffold verification but should remain non-sensitive. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 01-02. The workspace, package scripts, dependency lockfile, API skeleton, and web skeleton are in place for Prisma schema, seed data, production lines, and Beijing-time utilities.

## Self-Check: PASSED

- Found created root, API, and web files listed in key-files.
- Found commits `19567ad`, `471d4cd`, `023c286`, and `9e11982` in git history.
- Verified plan commands `pnpm install`, `pnpm typecheck`, and `pnpm test`.
- Confirmed `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` were updated locally.

---
*Phase: 01-foundation-auth-and-data-model*
*Completed: 2026-05-06*
