---
phase: 01-foundation-auth-and-data-model
plan: 01-04
subsystem: ui
tags: [react, vite, auth, rbac, session-expired, vitest]
requires:
  - phase: 01-03
    provides: [backend auth APIs, cookie sessions, production-line lookup, SESSION_EXPIRED response code]
provides:
  - Frontend login flow with production-line selection and remembered username/line defaults
  - First-password-change blocking screen for seeded/default-password users
  - Cookie-auth API client integration with centralized session-expired recovery
  - Role-aware app shell navigation and module placeholders
  - Logout action that clears backend and frontend session state
affects: [phase-01, phase-02, phase-03, phase-05, phase-06, web, auth, rbac]
tech-stack:
  added: []
  patterns:
    - React auth context owns active session and remembered login defaults
    - apiFetch sends credentials include and centralizes SESSION_EXPIRED handling
    - RoleNav derives visible modules from backend-provided user role
key-files:
  created:
    - apps/web/src/auth/LoginPage.tsx
    - apps/web/src/auth/ChangePasswordPage.tsx
    - apps/web/src/auth/ProtectedRoute.tsx
    - apps/web/src/shell/AppShell.tsx
    - apps/web/src/shell/RoleNav.tsx
    - apps/web/src/auth/LoginPage.test.tsx
    - apps/web/src/auth/auth-store.test.tsx
    - apps/web/src/shell/RoleNav.test.tsx
  modified:
    - apps/web/src/App.tsx
    - apps/web/src/App.test.tsx
    - apps/web/src/api/client.ts
    - apps/web/src/auth/auth-store.tsx
    - apps/web/src/auth/auth-types.ts
    - apps/web/src/components/Button.tsx
    - apps/web/src/components/TextInput.tsx
    - apps/web/src/components/Select.tsx
    - apps/web/src/components/Alert.tsx
    - apps/web/src/styles.css
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
key-decisions:
  - "Keep Phase 1 routing state local instead of adding React Router before real feature routes exist."
  - "Render role modules from a single RoleNav definition so future phases can attach real screens without duplicating role rules."
  - "Clear local auth state even if POST /auth/logout fails, because the user intent is to leave the terminal session."
patterns-established:
  - "Local UI components are reused for auth forms and shell actions."
  - "Frontend tests mock fetch at the API boundary and verify localStorage does not receive passwords."
  - "Role navigation visibility is covered with component tests for INSPECTOR, QUERY, and ADMIN."
requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, ROLE-01, ROLE-02, ROLE-03, ROLE-04, PLAT-02]
duration: 10 min
completed: 2026-05-06
---

# Phase 01 Plan 01-04: Web Login Flow, Role-Aware App Shell, and Session-Expired UX Summary

**React auth UI with production-line login defaults, forced password-change blocking, role-scoped shell navigation, logout, and lazy session-expired recovery**

## Performance

- **Duration:** 10 min continuation execution
- **Started:** 2026-05-06T08:20:20Z
- **Completed:** 2026-05-06T08:28:44Z
- **Tasks:** 4 completed
- **Files modified:** 21

## Accomplishments

- Added a cookie-auth frontend API client and auth store that persist only remembered username and production-line ID.
- Added local UI components and UI-SPEC styling for compact internal-tool login and shell screens.
- Implemented login with production-line loading, remembered defaults, no password persistence, and first-password-change blocking.
- Implemented protected app shell, role-aware navigation, module placeholders, logout, and session-expired recovery.
- Added frontend tests for login defaults, missing-password blocking, session-expired clearing, and role navigation visibility.

## Task Commits

Each task was committed atomically:

1. **Task 01-04-01: Add frontend API client and auth state** - `01b17ac` (feat)
2. **Task 01-04-02: Create local UI components from UI-SPEC** - `bed2002` (feat)
3. **Task 01-04-03: Implement login and first-password-change screens** - `1a3c1e9` (feat)
4. **Task 01-04-04: Implement app shell, role navigation, logout, and session-expired handling** - `28d1371` (feat)

## Files Created/Modified

- `apps/web/src/api/client.ts` - Credentialed `apiFetch` wrapper with `SESSION_EXPIRED` callback support.
- `apps/web/src/auth/auth-types.ts` - Frontend role, user, production-line, and session types.
- `apps/web/src/auth/auth-store.tsx` - Auth context, session clearing, session-expired notice, and remembered default helpers.
- `apps/web/src/auth/LoginPage.tsx` - Login form matching UI-SPEC copy and production-line/default behavior.
- `apps/web/src/auth/ChangePasswordPage.tsx` - Blocking first-password-change form with mismatch validation.
- `apps/web/src/auth/ProtectedRoute.tsx` - Authenticated route guard component.
- `apps/web/src/shell/AppShell.tsx` - Authenticated shell with user/role/line metadata and logout.
- `apps/web/src/shell/RoleNav.tsx` - Role-scoped navigation for inspection, query, and master-data placeholders.
- `apps/web/src/components/Button.tsx` - Local button with variants and loading label support.
- `apps/web/src/components/TextInput.tsx` - Labeled input with error state.
- `apps/web/src/components/Select.tsx` - Labeled select with loading/disabled state.
- `apps/web/src/components/Alert.tsx` - Status/error/success alert component.
- `apps/web/src/App.tsx` - Top-level auth flow switching between login, password change, and shell.
- `apps/web/src/styles.css` - UI-SPEC tokens plus login and app-shell layout styles.
- `apps/web/src/auth/LoginPage.test.tsx` - Login default persistence and missing-password blocking coverage.
- `apps/web/src/auth/auth-store.test.tsx` - Session-expired auth-store/API-client recovery coverage.
- `apps/web/src/shell/RoleNav.test.tsx` - Role-specific navigation visibility coverage.

## Decisions Made

- Kept routing local to `App.tsx` because Phase 1 only needs login, forced password change, and shell entry. A router can be added when later phases introduce real module routes.
- Used one `RoleNav` module registry to avoid duplicating role-to-module visibility rules across shell and tests.
- Logout clears local session state in `finally` so a terminal can always leave the authenticated UI even if the network request fails.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed login button accessible name while loading support was added**
- **Found during:** Task 01-04-03 (Implement login and first-password-change screens)
- **Issue:** The initial loading-label wiring used `aria-label`, which made the idle login button's accessible name `登录中...` instead of `登录`.
- **Fix:** Added a `loadingLabel` prop to `Button` so the visible/accessibility name stays `登录` while idle and changes only during loading.
- **Files modified:** `apps/web/src/components/Button.tsx`, `apps/web/src/auth/LoginPage.tsx`, `apps/web/src/auth/LoginPage.test.tsx`
- **Verification:** `pnpm test` passed and the login tests find the button by name `登录`.
- **Committed in:** `1a3c1e9`

**2. [Rule 1 - Bug] Guarded AppShell against undefined active module**
- **Found during:** Task 01-04-04 (Implement app shell, role navigation, logout, and session-expired handling)
- **Issue:** `pnpm typecheck` flagged that `activeModuleDefinition` could be undefined if no modules were available.
- **Fix:** Added a null guard before rendering module placeholder content.
- **Files modified:** `apps/web/src/shell/AppShell.tsx`
- **Verification:** `pnpm typecheck` and `pnpm test` passed.
- **Committed in:** `28d1371`

**3. [Rule 3 - Blocking] Updated planning state manually because the GSD SDK CLI is unavailable**
- **Found during:** Summary/state update
- **Issue:** `node ./node_modules/@gsd-build/sdk/dist/cli.js query state.load` failed because the SDK package is not installed, and `gsd-sdk` was not available on `PATH`.
- **Fix:** Updated `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` directly to record Plan 01-04 completion and completed requirement IDs.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`
- **Verification:** Files were staged in the metadata commit with this SUMMARY.
- **Committed in:** metadata commit

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocking issue)
**Impact on plan:** All fixes were required for accessibility correctness, TypeScript correctness, or GSD metadata completion. No feature scope was added beyond the Phase 1 frontend contract.

## Issues Encountered

- `pnpm lint` could not run to completion because both workspace packages use ESLint 9.39.4 but the repo has no `eslint.config.js` flat config. This is a pre-existing tooling gap from the scaffold, not a lint finding in the changed files.
- The manual two-browser-session validation from `01-VALIDATION.md` was not run in a browser during this executor continuation. The lazy invalidation behavior is covered by backend auth e2e tests from Plan 01-03 and frontend `SESSION_EXPIRED` clearing coverage from this plan.

## Verification

- `pnpm test` - PASSED: API 13 tests, web 7 tests.
- `pnpm typecheck` - PASSED for `apps/api` and `apps/web`.
- `pnpm db:validate` - PASSED.
- `pnpm lint` - BLOCKED by missing ESLint 9 flat config in both workspace packages.
- Manual two-session check from `01-VALIDATION.md` - NOT RUN; browser-only validation remains for UAT.

## Known Stubs

- `apps/web/src/shell/AppShell.tsx:73` renders `该功能将在后续阶段启用` intentionally for Phase 1 module placeholders. Real inspection, query, and master-data screens are scheduled for later phases.

## Threat Flags

None - frontend auth, logout, role navigation, and session-expired handling are the planned threat surface for this plan and are covered by the plan threat model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Phase 2. The frontend can authenticate with a selected production line, block default-password users before shell entry, expose role-scoped module placeholders, clear sessions on logout, and recover from lazy session invalidation using the backend `SESSION_EXPIRED` code.

## Self-Check: PASSED

- Found all created frontend auth and shell files listed in key-files.
- Found task commits `01b17ac`, `bed2002`, `1a3c1e9`, and `28d1371` in git history.
- Verified `pnpm test`, `pnpm typecheck`, and `pnpm db:validate` passed.
- Confirmed `pnpm lint` blocker is a missing ESLint 9 flat config, not a reported code lint violation.

---
*Phase: 01-foundation-auth-and-data-model*
*Completed: 2026-05-06*
