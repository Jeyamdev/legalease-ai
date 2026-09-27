# Member 1 integration with develop

This branch integrates the saved Member 1 implementation with develop commit
`7420000`. Older reports in this directory describe the previous schema and routes;
use this document for the integrated version.

## Compatibility decisions

- Existing `/api/lawyers` endpoints, booking slots, `/api/auth` endpoints, clerk
  login, service requests, database models and migrations remain unchanged.
- Member 1 CRUD/search/availability is at `/api/lawyer-management`. Search returns
  a paginated object, while the existing `/api/lawyers` still returns an array.
- Management login/registration is at `/api/member1/auth/login` and
  `/api/member1/auth/register`. Public registration only creates Customers.
  Tokens use the current integer `UserId` and `User.Role`. Management mutations
  reload the role from the database, so revoking Admin access takes effect.
- Lawyer profiles use the existing direct `Name`/`Email` fields and GUID
  `LawyerId`. No GUID User relationship is reintroduced. Creating a profile does
  not create login credentials or change another account. Optional `userId` is
  an integer and verifies the selected account's email; it is not a persisted FK.
- Deactivation retains the lawyer and its appointments. Availability with booking
  slots cannot be deleted or changed by the management module.
- The original frontend `/admin/lawyers`, booking, clerk and customer routes remain.
  Member 1 screens are under `/admin/lawyer-management`, with sign-in at
  `/admin/login`. Customer registration is `/signup` and its sign-in is
  `/member1/login`. Tokens for these screens remain in memory.
- Mobile platform files and the existing `main.dart` are preserved. The Member 1
  directory is available through a separate `lib/main_member1.dart` entry point.
- The recommendation service runs separately on port **8002**, leaving the team's
  AI service on port 8001. Its dependencies are in `requirements-member1.txt`
  (and the saved exact versions in `requirements-member1.lock.txt`), so the team's
  `requirements.txt` is preserved.

## Local setup

1. Restore and build `backend/LegalService.API/LegalService.API.csproj`. Configure
   the existing database and JWT credentials with .NET User Secrets or environment
   variables. Do not put credentials into tracked files. No migrations were added
   or applied during this integration. The restored UserSecretsId may select an old
   Member 1 database with the former GUID schema. Override
   `ConnectionStrings__DefaultConnection` with the approved develop database
   connection when that happens; do not migrate or reset the shared database.
2. In `frontend`, run `npm ci`. Set `VITE_API_URL=http://localhost:5295` and
   `VITE_API_BASE_URL=http://localhost:5295/api`, then run `npm run dev`.
3. In an AI virtual environment, install `requirements-member1.txt`. Configure
   `AI_INTERNAL_KEY` and `PLATFORM_API_BASE_URL=http://localhost:5295/api/`.
   Run `python -m uvicorn lawyer_recommendation.app:app --host 127.0.0.1 --port 8002`.
   Configure backend `Ai:BaseUrl=http://127.0.0.1:8002/` and the matching
   `Ai:InternalKey` using secrets/environment variables.
4. `python3 scripts/start-member1-local.py` starts these three services using local
   secrets. Stop existing instances first. It binds the API to 5295 to avoid the
   macOS service on port 5000, and does not start or stop the team's AI on 8001.
5. For the mobile directory, run `flutter pub get`, then
   `flutter run -t lib/main_member1.dart --dart-define=API_BASE_URL=http://localhost:5295/api`.
   Use a reachable host address for a physical device.

Use an existing authorized Admin account for management. The historical demo
account provisioning instructions based on UserRoles do not apply to develop's
current integer Users schema. No accounts were promoted by this integration.

## Validation

- Backend feature/API suite: 26 passed; one opt-in PostgreSQL test skipped.
- Frontend TypeScript and production build passed; 13 browser tests passed.
- ESLint passed for the new feature, tests and integrated App routes.
- Recommendation unit/transport suite: 9 passed.
- Mobile feature analysis passed; 3 feature/widget tests passed.
- Git conflict and whitespace checks passed. The saved stash is retained as a backup.

Browser tests mock API responses; backend integration tests use SQLite. The
PostgreSQL fixture is explicitly opt-in and was not run. These tests did not exercise live database writes, real AI requests or device
deployment. Startup retains develop's existing category seeder, which can update
category records. Read-only live checks are recorded separately below.
NuGet's unavailable vulnerability feed and Vite's bundle-size advisory are warnings,
not passing security/performance audits.

Live checks after selecting the existing develop database connection returned HTTP
200 for Swagger, the original `/api/lawyers`, the new management search, and both
catalog endpoints. The frontend and backend were restarted with the integrated
code. The standalone Member 1 recommendation service started on port 8002; no
live recommendation request or database mutation test was made.
