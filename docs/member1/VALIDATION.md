> Historical notes from before the develop integration. See [DEVELOP_INTEGRATION.md](DEVELOP_INTEGRATION.md) for current routes, schema, setup, and validation.

# Member 1 validation — 22 September 2026

For the subsequent review, fixes and current validation blockers, see
[REVIEW.md](REVIEW.md). The results below describe the original implementation.

## Executed successfully

| Command | Result |
|---|---|
| `git status --short --branch` before edits | Clean `main`; feature branch created before implementation |
| `dotnet restore backend/LegalService.API/LegalService.API.csproj` | Passed after sandbox network approval |
| `dotnet restore backend/LegalService.API.Tests/LegalService.API.Tests.csproj` | Passed after sandbox network approval |
| `dotnet build backend/LegalService.API/LegalService.API.csproj --no-restore` | Passed, zero warnings/errors |
| `dotnet test backend/LegalService.API.Tests/LegalService.API.Tests.csproj --no-restore` | **14 passed**, zero failed/skipped; final split-query implementation compiled and tested |
| `npm install --registry=https://registry.yarnpkg.com --fetch-retries=0` in frontend | Passed with TLS verification enabled; zero vulnerabilities reported |
| `npm run build` in frontend | Passed: TypeScript and Vite production bundle |
| `npm run lint` in frontend | Passed |
| `npx playwright install chromium` | Browser test runtime installed |
| `npm test` in frontend | **3 passed** in Chromium |
| `python3 -m venv ai-service/.venv` | Passed |
| `ai-service/.venv/bin/python -m pip install -r ai-service/requirements.txt` | Passed after sandbox network approval; resolved versions recorded in lock file |
| `.venv/bin/python -m unittest discover -s tests -v` in ai-service | **7 passed** |
| Temporary Flutter stable SDK checkout and `flutter --version` | Flutter 3.47.5 / Dart 3.13.4 |
| `flutter create --platforms=android,web --project-name=legal_service_mobile --no-pub .` in mobile | Generated runners, preserved Member 1 source |
| `flutter pub get` in mobile | Passed; lock file generated |
| `flutter analyze` in mobile | No issues found |
| `flutter test` in mobile | **3 passed** |
| `git diff --check` | Passed |

Flutter commands used `/tmp/member1-flutter-sdk/bin/flutter`, because Flutter was
not originally installed. The temporary SDK is not part of the repository.

## Coverage

Backend service tests: valid create/retrieve/update/deactivate, preserved shared
user ID/account/password, invalid name/email/license/experience, missing lawyer,
unique license/email, invalid/duplicate specialization/service associations,
relationship replacement, combined search filters/pagination/empty results,
availability date filters, adjacency/overlap/invalid range, update/delete scope,
protection of periods with Member 2 slots, catalog CRUD and assigned-delete checks.

Backend HTTP tests: public catalogs, 401 mutations, 400 request validation, blocked
public Admin registration, existing password-service login, 201/Location, 404,
204 deactivation, and 403 after immediate role revocation.

Browser tests: Admin route guard; actual React form/catalog numeric-ID submission;
empty list; profile navigation; availability submission/time serialization;
confirmation cancel/confirm and resulting Inactive status; non-Admin sign-in.
These tests mock the API, not the React UI.

AI tests: objective ordering and exclusion of inactive lawyers, availability date,
unknown requirement clarification, no available candidates, paginated retrieval
and deduplication, refusal to silently truncate excessive candidates, internal
API authentication and invalid request validation. All use controlled platform
data and require no provider keys.

Flutter tests: API filter/query serialization, empty results, network failure
state, and browse-screen widget rendering.

## Failures encountered and resolved

- Sandbox blocked Git ref writes, package networking, and VSTest local sockets;
  required commands were rerun with approved escalation.
- Default `npm install` failed because the network supplied an untrusted Fortinet
  certificate for the npm hostname. System CA retries did not help. The standard
  Yarn registry completed successfully with normal certificate verification.
  No `strict-ssl=false`, insecure curl, or certificate bypass was used.
- Initial backend compilation found the existing entity named `ValidationResult`
  conflicting with DataAnnotations; the new service now qualifies the type.
- The API test host needed its test JWT setting available before startup validation.
- Initial React compilation caught a JSX brace error in the new availability
  component and the existing React 19 `JSX.Element` type issue. Both were fixed.
- The first browser API route mock also intercepted Vite source modules under an
  `api/` directory; it now matches only paths beginning `/api/`.
- Python 3.14 exposed a Pydantic `date` annotation/name collision; the datetime
  type is now aliased explicitly and HTTP tests pass.
- Flutter analysis found five missing-brace style warnings; all were fixed.

## Not validated

- No PostgreSQL instance was contacted and no migration was applied. SQLite is
  relational but does not prove Npgsql SQL/SSI concurrency behavior. Test parallel
  overlapping availability and catalog/profile uniqueness against an approved
  PostgreSQL development instance before deployment.
- No live database-backed React → ASP.NET → Python deployment was exercised.
  Configure secrets and the existing database for that smoke test.
- No Android SDK/emulator/device build, APK signing, or production deployment was
  attempted. Mobile source analysis and unit/widget tests passed.
- Credential rotation, Git-history cleanup, historic Admin account review, and
  authorization of a real demo Admin require the database/repository owner.

Nothing was pushed, merged, rebased, or committed.
