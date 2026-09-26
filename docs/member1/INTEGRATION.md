> Historical notes from before the develop integration. See [DEVELOP_INTEGRATION.md](DEVELOP_INTEGRATION.md) for current routes, schema, setup, and validation.

# Member 1 local integration — 2026-09-25

Branch: `feature/member1-lawyer-management`. No commit, push, merge, rebase, new
project, new database, migration generation, or shared-model modification.

## Root causes and fixes

1. PostgreSQL was reachable, but the configured development database had no
   application tables or EF migration history. Consequently the first lawyer
   query failed with PostgreSQL 42P01 (`Lawyers` did not exist). The existing
   migrations were sufficient and were applied after inspecting their forward
   operations and the empty schema. No database reset or table/history deletion.
2. Development CORS needed both `localhost:5173` and `127.0.0.1:5173`. Both are now
   configured in `appsettings.Development.json`. The ignored frontend `.env.local`
   targets `http://localhost:5295/api` through the existing Axios client.
3. The API/Python internal recommendation key needed consistent configuration.
   A generated key lives only in User Secrets; the local launcher passes it to
   Python through its environment. PostgreSQL uses VerifyFull and the Mac trusted
   root bundle. JWT and database credentials remain in User Secrets.
4. No stale listener existed on 5295 at the start of this session. No unrelated
   process was stopped. The launcher starts the API with the existing HTTP profile.
5. The accidental untracked, empty API-folder npm lockfile was removed after
   verifying it had no tracked history or package dependencies.

The first live-browser attempt stopped because its exact label selector also
matched option text in an implicitly labelled select. The test selector was
corrected, the successful flow rerun, and that interrupted fixture cleaned up.
This was a test-selector issue; it did not require a product change.

## Database evidence

All three migrations were pending, then successfully applied:

- `20260819084112_AddAuthenticationTables`
- `20260821060106_AddUpdatedAtAndUserRoleRelationships`
- `20260825093751_InitialLegalPlatformSchema`

A subsequent EF migrations list and history query confirmed all three applied.
The inspected forward operations created tables/indexes/seeds and added nullable
UpdatedAt columns. Original migration files and model snapshot are unchanged.

Verified 26 application tables plus `__EFMigrationsHistory`:

```text
Users, Roles, UserRoles, Lawyers, Specializations, LawyerSpecializations,
LegalServices, LawyerLegalServices, LawyerAvailabilities, AvailabilitySlots,
Appointments, AppointmentStatusHistories, Careers, Clerks, DocumentFiles,
DocumentationRequests, DocumentationServices, JobApplications, ServiceRequests,
AgentSteps, AgentWorkflows, ApprovalDecisions, AuditLogs, ExecutionSummaries,
ToolExecutions, ValidationResults
```

Shared tables were created by the team's existing migration, not a Member 1
replacement. The appointment/slot integration fixture was transaction-only and
rolled back. No Member 2/3/4 production workflow was changed.

## Real HTTP results

49 HTTP checks exercised the live API and PostgreSQL (in addition to the browser):

| Route / operation | Observed result |
|---|---|
| GET lawyers, search, specializations, legal-services | 200; no database 500 |
| Register Customer / attempt Admin registration | 200 / 400 |
| Valid / invalid login | 200 JWT / 401 |
| Unauthenticated / Customer administrative mutation | 401 / 403 |
| Lawyer create / retrieve / update / deactivate | 201 / 200 / 200 / 204 |
| Invalid or duplicate association IDs | 400 |
| Duplicate license | 409 |
| Specialization and service create/get/update/delete | 201 / 200 / 200 / 204 |
| Delete assigned catalog entry | 409 |
| Get deleted catalog entry | 404 |
| Availability create/get/update/delete | 201 / 200 / 200 / 204 |
| Invalid time range / overlap | 400 / 409 |
| Concurrent duplicate availability requests | One 201, one 409 |
| Combined specialization/service/experience/status/date/pagination/sort | 200; expected stored fixture |
| Search with no matches / invalid page | 200 empty / 400 |
| Deactivated lawyer Admin / public detail | 200 Inactive / 404 |
| Property-dispute recommendation / no-match request | 200 grounded IDs / 200 empty |

Registration retained BCrypt hashing, verified from the stored hash format without
printing it. A newly registered demo Customer was granted Admin through the
README's database role assignment. Login then returned Admin authorization.
Only the generated demo account was provisioned; credentials are not in source.

Search uses server-side EF filtering, ordering and pagination. Existing composite
keys/foreign keys are retained. Recommendation retrieval uses filtered API pages,
not one availability HTTP request per lawyer. Returned IDs were checked against
PostgreSQL; inactive lawyers were excluded after deactivation. The analyzer is
the documented lexical catalog matcher, not a general semantic LLM.

## Browser result

Live Chromium, with no API mocks:

Admin login → create service → create lawyer → assign specialization/service →
add availability with seconds → edit profile → combine filters → view details →
grounded recommendation through API → confirm deactivation.

All passed; no JavaScript page errors. The successful browser test and interrupted
attempt left clearly labelled **inactive** profiles. Their temporary service and
availability records were removed. The HTTP suite's fixture is also inactive.
There is no pretend active lawyer data for production recommendations.

## Commands executed

| Check | Result |
|---|---|
| `dotnet restore` | Passed |
| `dotnet ef migrations list` | Initially three pending; final all applied |
| `dotnet ef database update` | Applied only the existing three migrations |
| `dotnet build` | Passed; 0 warnings/errors |
| `dotnet test backend/LegalService.API.Tests/LegalService.API.Tests.csproj` | 22 passed with opt-in PostgreSQL configured |
| `npm install --registry=https://registry.yarnpkg.com --fetch-retries=0` | Passed; TLS verification enabled; zero reported vulnerabilities |
| `npm run build` | Passed (TypeScript and Vite) |
| `npm run lint` | Passed |
| `npm test` | 6 passed: browser regressions and form schemas |
| `node integration/member1-live.mjs` via private credential wrapper | Passed against running PostgreSQL-backed stack |
| Existing AI venv: `python -m unittest discover -s tests -v` | 9 passed |
| `flutter pub get` | Passed |
| `flutter analyze` | No issues |
| `flutter test` | 3 passed |

The Flutter SDK was installed temporarily at `/tmp/member1-flutter-sdk`; Android
APK/device execution was not tested. Flutter package resolution reports newer
versions outside existing constraints; no dependency upgrade was needed.

## Files changed in this integration pass

- `backend/LegalService.API/appsettings.Development.json`: development CORS.
- `backend/LegalService.API.Tests/PostgresRelationshipTests.cs`: opt-in rolled-back
  PostgreSQL appointment/slot preservation test.
- `frontend/integration/member1-live.mjs`: real-server browser verification.
- `scripts/start-member1-local.py`: start the existing three services with local
  secret configuration shared through environment variables.
- `scripts/verify-member1-local.py`: opt-in backend/live-browser checks without
  printing local credentials.
- `docs/member1/README.md`, this report, and `FILES.md`: current setup/evidence.
- Removed accidental untracked `backend/LegalService.API/package-lock.json`.
- Local only: User Secrets and gitignored `frontend/.env.local`.

The branch also retains the prior Member 1 implementation/review changes listed
in `FILES.md`; they were not overwritten or committed in this pass.

## Running and remaining manual checks

From the repository root, with installed dependencies and existing local secrets:

```sh
python3 scripts/start-member1-local.py
```

Frontend/Admin: `http://127.0.0.1:5173/admin/login`.
Swagger: `http://localhost:5295/swagger/index.html`.
Internal recommendation service: `http://127.0.0.1:8001`.
The services were left running after verification; do not launch a second copy.

View `Member1Demo:AdminEmail` and `Member1Demo:AdminPassword` privately in the local
User Secrets editor to log in. Add an actual lawyer profile and relevant catalog
associations for your demo; test profiles were deliberately deactivated. A no-match
recommendation is expected until an active matching profile exists.

Run the opt-in tests with `python3 scripts/verify-member1-local.py backend` or
`python3 scripts/verify-member1-local.py browser`. Browser verification requires
running services and creates labelled test records; backend PostgreSQL fixtures
are always rolled back. Ordinary backend tests skip the PostgreSQL-only test when
its environment configuration is absent.

Security scan found no current local secret values in Git-visible source; the
pattern match on the browser test was an environment-variable assignment, not a
credential. Historical exposed PostgreSQL credentials still require owner-led
rotation and coordinated history cleanup. Neither rotation nor history rewriting
was performed. Review historical privileged accounts if any exist elsewhere.
The optional `GET /health` probe returned 404 because the existing Python service
has no health route; service verification used its actual recommendation endpoint.
No certificate checks were disabled and no AI credentials entered React/Flutter.

Before a PR/demo: inspect the intended diff, privately retrieve demo credentials,
rotate previously exposed credentials and update User Secrets, and validate any
Android device or deployed environment separately. Member 2 still owns slots and
booking; Member 4 owns coordinator execution, approvals and audit persistence.
The existing shadow slot LawyerId navigation and ADR/schema naming discrepancy
remain documented in README; they were not rewritten for this integration.

Final Git checks: `git status`, `git diff --stat`, and `git diff --check` ran.
The whitespace check passed. Tracked diff statistics do not include untracked
Member 1 additions; review the file inventory and status as well.
