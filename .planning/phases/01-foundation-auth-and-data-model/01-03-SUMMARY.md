---
phase: 01-foundation-auth-and-data-model
plan: 01-03
subsystem: auth
tags: [nestjs, auth, sessions, rbac, cookies, prisma, sqlite, jest]
requires:
  - phase: 01-02
    provides: [Prisma schema, User model, Session model, ProductionLine model, PrismaService]
provides:
  - Backend login/logout/current-session/password-change APIs
  - Database-backed httpOnly cookie sessions with hashed opaque tokens
  - One-active-session policy where newest login invalidates prior sessions
  - SessionGuard, Roles decorator, RolesGuard, and CurrentUser decorator
  - Auth e2e coverage for cookies, forced password-change flag, logout, session invalidation, and RBAC denial
affects: [phase-01, auth, sessions, rbac, production-lines, api]
tech-stack:
  added: []
  patterns:
    - Auth endpoints return sanitized user and production-line shapes only
    - Session tokens are generated randomly and stored only as SHA-256 hashes
    - Protected controllers receive authenticated context from SessionGuard
key-files:
  created:
    - apps/api/src/auth/auth.module.ts
    - apps/api/src/auth/auth.controller.ts
    - apps/api/src/auth/auth.service.ts
    - apps/api/src/auth/dto/login.dto.ts
    - apps/api/src/auth/dto/change-password.dto.ts
    - apps/api/src/auth/session.guard.ts
    - apps/api/src/auth/roles.decorator.ts
    - apps/api/src/auth/roles.guard.ts
    - apps/api/src/auth/current-user.decorator.ts
    - apps/api/src/users/users.module.ts
    - apps/api/src/users/users.service.ts
    - apps/api/src/sessions/sessions.module.ts
    - apps/api/src/sessions/sessions.service.ts
    - apps/api/test/auth.e2e-spec.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/main.ts
    - apps/api/src/production-lines/production-lines.service.ts
key-decisions:
  - "Use opaque random session cookies and persist only SHA-256 token hashes in the Session table."
  - "Implement newest-login-wins by creating the new session and revoking other active sessions for the same user in a single Prisma transaction."
  - "Return SESSION_EXPIRED for missing, revoked, expired, inactive-user, or inactive-production-line session contexts so old terminals have one frontend recovery path."
patterns-established:
  - "AuthService owns credential validation and sanitized response shaping."
  - "SessionGuard is the backend authentication boundary for protected routes."
  - "RolesGuard reads @Roles metadata with Nest Reflector and denies mismatched roles with ROLE_FORBIDDEN."
requirements-completed: [AUTH-01, AUTH-02, AUTH-04, ROLE-04, PLAT-02, PLAT-03]
duration: 13 min
completed: 2026-05-06
---

# Phase 01 Plan 01-03: Authentication, One-Active-Session Policy, and Backend RBAC Summary

**Backend auth foundation with httpOnly cookie sessions, newest-login-wins invalidation, first-password-change support, and NestJS RBAC guards**

## Performance

- **Duration:** 13 min
- **Started:** 2026-05-06T05:33:29Z
- **Completed:** 2026-05-06T05:46:49Z
- **Tasks:** 4 completed
- **Files modified:** 17

## Accomplishments

- Added `UsersService` for user lookup, Argon2 password verification, and password changes that clear `mustChangePassword`.
- Added `SessionsService` for random opaque session tokens, SHA-256 token-hash persistence, UTC expiry/last-seen timestamps, session revocation, and transaction-backed newest-login-wins creation.
- Added `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, and `POST /auth/change-password`.
- Added `SessionGuard`, `@Roles`, `RolesGuard`, and `CurrentUser` for backend authentication and RBAC enforcement.
- Added auth e2e tests covering invalid credentials, httpOnly cookies, forced password-change flag, password change, two-login invalidation, lazy `SESSION_EXPIRED`, logout clearing, and role denial.

## Task Commits

Each task was committed atomically:

1. **Task 01-03-01: Create users and sessions services** - `ec3ff65` (feat)
2. **Task 01-03-02: Create auth controller and cookie session flow** - `8aa23a7` (feat)
3. **Task 01-03-03: Add session and role guards** - `ca08218` (feat)
4. **Task 01-03-04: Add backend auth and RBAC tests** - `9608c33` (test)

## Files Created/Modified

- `apps/api/src/users/users.service.ts` - User lookup, Argon2 password verification, and password update behavior.
- `apps/api/src/users/users.module.ts` - Users feature module export.
- `apps/api/src/sessions/sessions.service.ts` - Hashed-token session persistence, transaction-backed login session creation, revocation, and last-seen updates.
- `apps/api/src/sessions/sessions.module.ts` - Sessions feature module export.
- `apps/api/src/auth/auth.module.ts` - Auth feature module composition.
- `apps/api/src/auth/auth.service.ts` - Credential validation, active user/line checks, login response shaping, and password-change delegation.
- `apps/api/src/auth/auth.controller.ts` - Login/logout/me/change-password endpoints and cookie set/clear behavior.
- `apps/api/src/auth/dto/login.dto.ts` - Login request validation contract.
- `apps/api/src/auth/dto/change-password.dto.ts` - Password-change request validation contract.
- `apps/api/src/auth/session.guard.ts` - Cookie session validation and authenticated request context attachment.
- `apps/api/src/auth/roles.decorator.ts` - Role metadata decorator.
- `apps/api/src/auth/roles.guard.ts` - Backend role authorization guard.
- `apps/api/src/auth/current-user.decorator.ts` - Controller decorator for authenticated context.
- `apps/api/src/production-lines/production-lines.service.ts` - Active production-line lookup by id for login validation.
- `apps/api/src/app.module.ts` - Imports auth, users, and sessions modules.
- `apps/api/src/main.ts` - Adds global DTO validation pipe.
- `apps/api/test/auth.e2e-spec.ts` - Auth/session/RBAC e2e and guard coverage.

## Decisions Made

- Store only token hashes in SQLite; raw session tokens exist only in the httpOnly cookie returned to the browser.
- Keep the cookie unsigned for now because the token is random and server-validated by hash; integrity comes from database lookup rather than client-readable claims.
- Treat inactive users or inactive production lines on a session as `SESSION_EXPIRED` for consistent old-terminal recovery.
- Use a 12-hour default session TTL through `SESSION_TTL_HOURS`, configurable by environment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Enabled DTO validation globally**
- **Found during:** Task 01-03-04 (Add backend auth and RBAC tests)
- **Issue:** DTO classes had validation rules, but the API bootstrap did not enable Nest's validation pipe.
- **Fix:** Added `ValidationPipe({ whitelist: true })` in `apps/api/src/main.ts` and initialized the same pipe in auth e2e tests.
- **Files modified:** `apps/api/src/main.ts`, `apps/api/test/auth.e2e-spec.ts`
- **Verification:** `pnpm test`, `pnpm typecheck`, and `pnpm db:validate` passed.
- **Committed in:** `9608c33`

---

**Total deviations:** 1 auto-fixed (1 Rule 2 missing critical functionality)
**Impact on plan:** No scope expansion beyond required input validation for the new auth DTO boundary.

## Issues Encountered

- The first auth test run failed on TypeScript typing for `set-cookie` headers. Added a small `setCookies` helper in the test file and reran successfully.

## Verification

- `pnpm --filter @scan/api typecheck` - PASSED after service/controller/guard tasks
- `pnpm --filter @scan/api test` - PASSED
- `pnpm db:validate` - PASSED
- `pnpm test` - PASSED
- `pnpm typecheck` - PASSED

## Known Stubs

None.

## Threat Flags

None - the new authentication endpoints, session cookie behavior, and RBAC guards are the planned threat surface for this plan and are covered by the plan threat model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 01-04. The frontend can now call `/production-lines`, `/auth/login`, `/auth/me`, `/auth/change-password`, and `/auth/logout`, and can use `SESSION_EXPIRED` for lazy old-terminal kickout handling.

## Self-Check: PASSED

- Found created auth, users, sessions, and auth e2e files listed in key-files.
- Found task commits `ec3ff65`, `8aa23a7`, `ca08218`, and `9608c33` in git history.
- Verified plan commands `pnpm db:validate`, `pnpm test`, and `pnpm typecheck`.
- Confirmed no tracked file deletions were introduced by task commits.

---
*Phase: 01-foundation-auth-and-data-model*
*Completed: 2026-05-06*
