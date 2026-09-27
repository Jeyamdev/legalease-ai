> Historical notes from before the develop integration. See [DEVELOP_INTEGRATION.md](DEVELOP_INTEGRATION.md) for current routes, schema, setup, and validation.

# Frontend authentication fix — 2026-09-25

## Root cause

The landing-page navigation linked to `/login` and `/signup`, but App.tsx defined
neither route. There was no Customer login or registration form/API submission.
Only `/admin/login` existed, and it deliberately rejected Customer accounts.
Its failed-credentials message was generic, and it lacked RHF/Zod validation.

This was not a PostgreSQL, CORS, JWT-property, or API-base-URL failure. Direct HTTP
tests verified the existing endpoints before changes. No backend application code,
entity, migration, schema, or other member's workflow changed in this fix.

## Existing contract and fix

- Registration: `POST /api/auth/register` with `fullName`, `email`, `password`,
  `role: "Customer"`. No phone is required; no `name` alias is used. Confirm password
  is frontend-only. Success is 200 with `message`, `userId`, `role`.
- Login: `POST /api/auth/login` with `email`, `password`; response has `token`,
  `email`, `role`, `roles`. Use `roles` for the Admin redirect because an account
  can hold more than one role. No second authentication system was introduced.
- Registration validates full name (1–200), email (maximum 254), password (12–72),
  and matching confirmation. Login permits existing shorter passwords, matching
  the backend login contract. Submission controls disable during requests.
- Duplicate registration, invalid credentials, validation responses, and network
  failures are displayed without raw objects or credentials.
- Registration redirects to `/login` with confirmation. Customer login returns
  to the existing landing page; Admin login returns to `/admin/lawyers`.
- `/admin` now redirects to its existing lawyer-management child route.
- Navbar reflects the existing session and supplies Customer logout. Admin logout
  continues to clear the same store and redirect through the existing guard.

The existing Axios client remains centralized at `VITE_API_BASE_URL` (configured
as `http://localhost:5295/api` locally) and attaches the existing Zustand token.
No new storage or auth store was added. The documented **in-memory** policy is
preserved: refreshing signs the user out; Admin guards then show `/admin/login`.
No tokens are written to localStorage/sessionStorage. Backend roles remain the
security boundary. Both existing development CORS origins were verified; no CORS
change was needed.

## Files changed in this pass

- `frontend/src/App.tsx`: public auth routes and Admin index redirect.
- `frontend/src/components/common/Navbar.tsx`: existing-session display/logout.
- `frontend/src/features/lawyers/pages/AdminLoginPage.tsx`: shared login-page wrapper.
- `frontend/src/features/auth/LoginPage.tsx`, `SignupPage.tsx`: RHF/Zod forms.
- `frontend/src/features/auth/api.ts`, `schemas.ts`: contract mapping and validation.
- `frontend/tests/auth.spec.ts`: validation and error regression tests.
- `frontend/integration/auth-live.mjs`: opt-in real PostgreSQL browser flow.
- `frontend/playwright.config.ts`: isolated test port 5175 to avoid conflicting
  with the running development server on 5173.
- `backend/LegalService.API.Tests/AuthenticationTests.cs`: isolated SQLite auth
  contract/validation/hash/role tests, using the existing ApiFactory.
- `scripts/verify-member1-local.py`: `auth` option reusing private User Secrets.
- `docs/member1/README.md` and this report: updated auth instructions/evidence.

Earlier uncommitted Member 1 changes remain; do not confuse the whole branch diff
with just this frontend authentication fix.

## Verification

- Direct live API: Customer registration 200; duplicate/invalid/Admin registration
  400; valid login 200 with expected properties; bad credentials 401.
- `npm run build`: passed (TypeScript + Vite).
- `npm run lint`: passed.
- `npm test`: 9 passed, including the existing lawyer-management regressions.
- `dotnet test backend/LegalService.API.Tests/LegalService.API.Tests.csproj --filter
  'FullyQualifiedName~AuthenticationTests|FullyQualifiedName~ApiTests'`: 5 passed.
- `python3 scripts/verify-member1-local.py auth`: passed with actual HTTP requests,
  no API mocks. Signup from the landing-page link, invalid login, Customer login,
  duplicate signup, logout, Admin denial, Admin login through both URLs, Admin
  index redirect, Bearer attachment, and refresh behavior were verified.
- The browser-created Customer row/role/hashed password were verified directly
  in PostgreSQL. Labelled test Customer accounts remain in the development DB.
- No browser JavaScript errors. CORS OPTIONS returned 204 with each correct origin:
  `http://127.0.0.1:5173` and `http://localhost:5173`.
- GET `/api/lawyers`, `/api/lawyers/search`, `/api/specializations`, and
  `/api/legal-services` all returned 200. Admin Lawyer Management rendered.

Live checks need the existing local services and private demo Admin credentials
already configured in User Secrets. No credential values were printed. A startup
attempt found already-running frontend/AI ports; verification reused the existing
services rather than replacing unrelated processes.

Use `http://127.0.0.1:5173/signup` for Customer registration,
`http://127.0.0.1:5173/login` for general login, or `/admin/login` for Admin-only
login. There is no remaining blocker in the tested local auth flow. Refresh still
requires login by design; password recovery/session persistence are not added.

No commit, push, merge, rebase, or migration generation was performed. Historical
credential rotation remains the database owner's existing responsibility.
