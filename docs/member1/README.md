> Historical notes from before the develop integration. See [DEVELOP_INTEGRATION.md](DEVELOP_INTEGRATION.md) for current routes, schema, setup, and validation.

# Member 1 — Lawyer & Legal Service Management

Implementation branch: `feature/member1-lawyer-management`. No push, merge, rebase,
or commit is part of this implementation.

## Scope and existing architecture

The original repository supplied entities, three migrations, role/catalog seeds,
registration/password hashing, and the React landing page. It had no Member 1
controllers, services, clients, AI service, or tests. `mobile/` and `ai-service/`
were placeholders. This implementation extends those existing locations.

- ASP.NET Core 8 uses the existing `ApplicationDbContext`, entities, PostgreSQL
  configuration, BCrypt service, and users/roles. DTOs keep EF entities out of API responses.
- React uses the existing Vite/Tailwind 4 theme, React Router, Axios, RHF and Zod.
  Zustand manages the in-memory session per ADR-001; URL parameters hold list
  filters. Feature hooks manage request state and cancel obsolete reads. No second
  query/global-state library is introduced.
- Flutter uses Provider/ChangeNotifier per ADR-002. Android/web runners were
  initialized inside the original empty `mobile/` directory.
- Python uses LangGraph/FastAPI per ADR-003. Recommendation is a specialized
  graph, not the coordinator, approval engine, or global workflow store.

## Schema decisions and compatibility

**No entity, DbContext, existing migration, or model snapshot changes. No new
migration or database.**

`LawyerId` remains a GUID that is also the existing user's `Id`. Name/email live
on `User`; profile fields remain on `Lawyer`. Create accepts an optional `userId`
to attach an existing active account. With no `userId`, an administrator creates
an account/profile with an empty password hash: it is a directory record and
cannot log in. No password or fake credential is created. Future account
activation/password invitation belongs to the shared authentication owner.

- `DELETE /api/lawyers/{id}` sets `Lawyer.Status = Inactive`; it does not delete
  users, appointments, slots, or relationships, or deactivate unrelated user roles.
- Profile writes validate and atomically update relationships. Duplicate input IDs
  are rejected with 400. Existing composite keys prevent duplicate bridge rows.
- Existing email/license/specialization uniqueness is retained. Case-normalized
  comparisons and serializable mutation transactions protect Member 1 writes.
- Assigned catalog entries cannot be deleted (409), preventing accidental loss of
  associations through the existing cascading delete rules.
- Availability overlap uses half-open periods: 09:00–10:00 and 10:00–11:00 are
  allowed; overlapping or duplicate periods are rejected with 409. Serializable
  PostgreSQL transactions protect concurrent writes; serialization conflicts
  return 409 and can be retried after refreshing.
- Availability with **any** Member 2 slot cannot be edited/deleted. No slot or
  appointment lifecycle is implemented here.
- Dates/times use the existing `DateOnly`/`TimeOnly` schema and Asia/Colombo local
  time. A date match means a recorded working period, **not** a guaranteed free
  appointment slot. Past periods can be retained for history.

Existing issues deliberately left intact: `Lawyer.AvailabilitySlots` produces a
nullable shadow `LawyerId` foreign key in the original migration. Member 2 should
agree which navigation it uses. ADR-004 describes `AgentWorkflowStates` and
`AgentAuditLogs`, while actual entities use `AgentWorkflow`, `AgentStep`, and
`AuditLog`; Member 4 must resolve that discrepancy. Some original seeded entities
initialize `CreatedAt` dynamically; review future migration diffs for seed-time
churn rather than regenerating the team's migrations.

## API contract

All paths are relative to the ASP.NET API host. Lawyer/availability IDs are GUIDs;
catalog IDs are integers. ASP.NET's default JSON naming is camelCase.

| Method | Path | Access | Result |
|---|---|---|---|
| POST | `/api/lawyers` | Admin | 201 lawyer detail + Location |
| GET | `/api/lawyers` | Public | Paginated summary list |
| GET | `/api/lawyers/search` | Public | Same list with filters |
| GET | `/api/lawyers/{id}` | Public | Lawyer detail; 404 if not visible |
| PUT | `/api/lawyers/{id}` | Admin | Updated detail |
| DELETE | `/api/lawyers/{id}` | Admin | 204; profile deactivated |
| GET | `/api/lawyers/{id}/availability` | Public | Ordered working periods |
| POST | `/api/lawyers/{id}/availability` | Admin | 201 period + Location |
| PUT | `/api/lawyers/{id}/availability/{availabilityId}` | Admin | Updated period |
| DELETE | `/api/lawyers/{id}/availability/{availabilityId}` | Admin | 204 |
| GET | `/api/specializations` | Public | Catalog list |
| GET | `/api/specializations/{id}` | Public | Catalog detail |
| POST | `/api/specializations` | Admin | 201 + Location |
| PUT | `/api/specializations/{id}` | Admin | Updated catalog entry |
| DELETE | `/api/specializations/{id}` | Admin | 204, or 409 if assigned |
| GET | `/api/legal-services` | Public | Catalog list |
| GET | `/api/legal-services/{id}` | Public | Catalog detail |
| POST | `/api/legal-services` | Admin | 201 + Location |
| PUT | `/api/legal-services/{id}` | Admin | Updated catalog entry |
| DELETE | `/api/legal-services/{id}` | Admin | 204, or 409 if assigned |
| POST | `/api/lawyer-recommendations` | Authenticated | Grounded recommendations + warnings + trace |
| POST | `/api/auth/login` | Public | JWT, email, role, roles |
| POST | `/api/auth/register` | Public | Existing response shape; Customer only |

Unauthenticated mutations return 401, insufficient role 403, invalid bodies/query
parameters 400, missing records 404, data conflicts 409. Unexpected errors return
a generic problem response with a trace ID; full exception details are logged
server-side. Malformed GUID route segments do not match the route (404).

Public reads only expose Active profiles on active accounts. Admin reads include
Inactive/Suspended profiles. Valid profile statuses: `Active`, `Inactive`,
`Suspended`. Public filtering cannot override visibility.

Search parameters: `search` (name), `specializationId`, `legalServiceId`,
`minExperience`, `status`, `date` (`YYYY-MM-DD`), `page` (default 1), `pageSize`
(default 20, maximum 100), `sort` (`name`, `experience`, `experience_desc`). Filters
combine with AND. Ordering always adds the stable GUID tie-breaker. Result:

```json
{"items": [], "totalCount": 0, "page": 1, "pageSize": 20}
```

Lawyer create/update body (omit userId to create a profile-only account):

```json
{
  "name": "Example Lawyer",
  "email": "lawyer@example.com",
  "phoneNumber": "+94771234567",
  "qualification": "LLB",
  "experience": 5,
  "licenseNumber": "YOUR-LICENSE-NUMBER",
  "profileDescription": "Recorded profile description",
  "status": "Active",
  "specializationIds": [2],
  "legalServiceIds": [2]
}
```

Catalogs consistently use `{id, name, description, category?}` DTOs. `name` maps
to `LegalService.ServiceName` for services. Category is only stored for services.
Availability bodies use `{date, startTime, endTime}`, e.g. `"09:00:00"` and
`"10:00:00"`. Responses add `availabilityId` and `hasSlots`.

## React pages and reusable components

- `/login`: Customer/Admin sign in; redirects by returned roles.
- `/signup`: Customer-only registration, then login.
- `/admin/login`: administrator sign in, error state, role check.
- `/admin/lawyers`: search, all API filters, sorting, pagination, loading/error/
  empty states, status/catalog display.
- `/admin/lawyers/new`: validated profile form and multi-catalog associations.
- `/admin/lawyers/:id`: profile details, availability CRUD, deactivation confirmation.
- `/admin/lawyers/:id/edit`: profile and association editing.
- `/admin/specializations` and `/admin/legal-services`: create/edit/delete catalogs.

Reusable components: `LawyerForm`, `AvailabilityManager`, `Field`, `Feedback`,
`ConfirmDialog`, and `AdminLayout`. Native modal dialogs provide focus containment
and Escape/cancel behavior. Destructive controls disable while saving. Tokens
stay in memory; refresh requires signing in again. Server authorization is the
security boundary, independent of route guards.

The landing page remains at `/`. One existing `JSX.Element` annotation was changed
to an imported `ReactElement` to compile with the project's React 19 types.

## Flutter screens

`LawyerBrowseScreen`: name search, specialization filtering, pagination and
loading/empty/error states. `LawyerProfileScreen`: profile, contact, qualifications,
services, specialization links, and availability. `SpecializationScreen`: stored
specialization description. `LawyerCard` and `LoadError` are reusable widgets.
API URLs are passed with `--dart-define`, never hardcoded into screens. No booking
buttons or appointment workflows are added.

## Recommendation graph and Member 4 boundary

```text
Authenticated client → ASP.NET ILawyerRecommendationService → private FastAPI
  analyze stored catalogs → retrieve API candidates → evaluate/rank → validate
                                                        ↓
                         ASP.NET rechecks IDs/status/date → client
```

The requirement analyzer is explicitly **deterministic lexical matching**, using
words from actual catalog names/descriptions/categories. It is an explainable
baseline, not an LLM-backed semantic classifier or automated legal advice. Unknown
wording asks for clarification instead of inventing specializations. Negation,
multilingual input, and subtle intent are limitations; a future Member 4 analyzer
can inject validated catalog IDs/data through the integration boundary.

Ranking: 50 per matched specialization + 30 per matched service + recorded years
of experience capped at 30 + 20 for a requested date with recorded availability.
Inactive candidates are excluded. A requested date requires a matching working
period. Ties use lawyer ID. No review, success-rate, or unrecorded credential data
is used. Retrieval pages through matching API results, deduplicates candidates,
and rejects more than 1,000 candidates rather than silently truncating rankings.

Input: `{"requirement":"Help with divorce and custody", "date":"2030-01-01",
"limit":5}`. Output includes `{recommendations:[{lawyerId, score, reason}],
warnings:[], trace:[...]}`. Internal calls require matching server-side keys.
The C# gateway verifies returned IDs, active accounts/status and requested date
again, catching deletions/status changes between reads.

Member 4 can call the C# `ILawyerRecommendationService` or compose Python
`build_recommendation_graph(PlatformData)` as a subgraph. `PlatformData` is an
injectable allow-listed data interface; `HttpPlatformData` implements the existing
API access. Its `candidates(specialization_ids, service_ids, date=None)` contract
applies requested-date availability through the existing search endpoint, avoiding
per-lawyer availability HTTP requests. Return traces describe analysis IDs, candidate counts, ranking, and
validation; Member 4 owns persisting them in its chosen AgentStep/audit structures,
checkpoints, workflow lifecycle, approvals and summaries. This graph does not
write those tables or add an alternative global workflow system.

Framework references: [LangGraph StateGraph](https://reference.langchain.com/python/langgraph/graph/state)
and [ASP.NET JWT validation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication).

## Security findings and changes

The original tracked appsettings connection string and root text file exposed
PostgreSQL credentials. They have been removed from the working tree; values are
not reproduced in this guide. **The database owner must rotate the exposed
credential and coordinate Git-history cleanup.** No external rotation/history
rewrite was performed.

Public registration previously accepted arbitrary roles, including Admin. It now
only accepts Customer. Existing registration response shape/password hashing are
retained. Login/JWT completes the previously unused JWT infrastructure. Tokens
validate signature, issuer, audience and expiry. Each authenticated request
reloads active-account state and roles, so revoked Admin access takes effect
immediately. Existing privileged accounts created via the old registration route
should be reviewed by the team.

The app requires a server-side signing key of at least 32 bytes; no development
secret is supplied. Environment files, build caches, and local configuration are
ignored. No frontend/mobile AI key is used. CORS allows configured origins only.
TLS checks stayed enabled during all dependency installations; the standard Yarn
registry was used when Fortinet interception made the npm hostname untrusted.
[Yarn documents this registry](https://yarnpkg.com/getting-started/qa).

## Local setup — existing database

Prerequisites: .NET 8 SDK, Node 22.12+ (tested 22.23.2), Python 3.10+ (tested 3.14.4),
Flutter 3.35+ (tested 3.47.5), and access to the **existing** development PostgreSQL
database. Do not point test commands at the team's production database.

From the repository root, configure local secrets (substitute your own values):

```sh
cd backend/LegalService.API
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Host=YOUR_HOST;Database=YOUR_DATABASE;Username=YOUR_USER;Password=YOUR_PASSWORD;SSL Mode=VerifyFull'
dotnet user-secrets set 'Jwt:Key' 'YOUR_RANDOM_SECRET_OF_AT_LEAST_32_BYTES'
dotnet restore
dotnet build
dotnet run --launch-profile http
```

The key should be randomly generated, e.g. with `openssl rand -base64 48`; do not
use the illustrative placeholder as an actual key. Environment variables
`ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience`
are equivalent configuration inputs. Default issuer/audience are in appsettings.
Swagger: `http://localhost:5295/swagger`. The development HTTP profile runs on
5295; production uses HTTPS. Set `Cors__Origins__0` for a different frontend origin.

If the existing database does not yet have the team's migrations, coordinate with
the team before applying them. With EF CLI 8 installed, run
`dotnet ef database update --project backend/LegalService.API` from the repository
root with `ASPNETCORE_ENVIRONMENT=Development` so EF loads User Secrets.
No migration generation is needed. On September 25, all three existing migrations
were applied to the configured empty development database; see [INTEGRATION.md](INTEGRATION.md).
On this Mac, the local connection uses `Root Certificate=/etc/ssl/cert.pem` with
`SSL Mode=VerifyFull`. Use your trusted certificate store on other machines; never
disable certificate validation.

Create your own Customer account with `/signup` or `POST /api/auth/register` (fullName, email,
password of 12–72 characters, role Customer). An existing database administrator
must grant the Admin role to that account for the demo. In psql connected to your
existing development database, replace the email only:

```sql
INSERT INTO "UserRoles" ("UserId", "RoleId")
SELECT u."Id", r."Id"
FROM "Users" u CROSS JOIN "Roles" r
WHERE lower(u."Email") = lower('YOUR_ADMIN_EMAIL') AND r."Name" = 'Admin'
ON CONFLICT DO NOTHING;
```

No public Admin provisioning endpoint or seeded password exists. Sign in at the
React `/admin/login` page once the role is granted.

Frontend (new terminal):

```sh
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:5173/admin/login`. The API base URL is
`VITE_API_BASE_URL`; the example uses `http://localhost:5295/api`. Without it the
client uses relative `/api`, suitable behind a same-origin proxy. For the
certificate issue on this machine, the TLS-verified equivalent command was
`npm install --registry=https://registry.yarnpkg.com --fetch-retries=0`.
No certificate-validation bypass is needed.

AI service (new terminal):

```sh
cd ai-service
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.lock.txt
export PLATFORM_API_BASE_URL='http://localhost:5295/api/'
export AI_INTERNAL_KEY='YOUR_RANDOM_INTERNAL_KEY'
uvicorn lawyer_recommendation.app:app --host 127.0.0.1 --port 8001
```

Configure the API to match, then restart it:

```sh
cd backend/LegalService.API
dotnet user-secrets set 'Ai:BaseUrl' 'http://localhost:8001/'
dotnet user-secrets set 'Ai:InternalKey' 'YOUR_RANDOM_INTERNAL_KEY'
```

Call `POST /api/lawyer-recommendations` with a valid login bearer token. The Python
port is internal and should not be exposed to clients. Internal key and base URL
are deployment settings, not client input. No AI provider credential is required
for this deterministic version. HTTP is for loopback development; use private
networking/TLS for deployed service-to-service traffic.

Flutter (new terminal):

```sh
cd mobile
flutter pub get
flutter analyze
flutter test
flutter run -d chrome --web-port 5174 --dart-define=API_BASE_URL=http://localhost:5295/api
```

For Flutter web, also set API `Cors__Origins__2=http://localhost:5174` before
starting the API. For Android emulator use
`flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5295/api`; bind the API to a
reachable interface if necessary. Physical devices need your development
machine's reachable address or deployed HTTPS API. Android debug permits local
HTTP; release builds require HTTPS. Android SDK/emulator is required for APK or
on-device validation. The temporary SDK used here is `/tmp/member1-flutter-sdk`;
install Flutter persistently for ongoing development.

## File inventory

See [FILES.md](FILES.md) for all additions and existing-file changes.

## Tests and limitations

See [INTEGRATION.md](INTEGRATION.md) for September 25 real PostgreSQL, HTTP,
browser and test results. [VALIDATION.md](VALIDATION.md) and [REVIEW.md](REVIEW.md)
are historical reports; their earlier database/testing blockers have been resolved.
The ordinary backend suite uses relational SQLite in memory. An opt-in PostgreSQL
test verifies appointment/slot references in a transaction that is always rolled back.
Mocked browser tests cover UI regressions; a separate live script exercises real
API/database traffic, creates labelled fixtures and safely deactivates its lawyer.

With dependencies installed and local secrets configured, start all three existing
services from the repository root:

```sh
python3 scripts/start-member1-local.py
```

Open `http://127.0.0.1:5173/admin/login`; Swagger is
`http://localhost:5295/swagger/index.html`. Ctrl+C stops the launcher’s services.
Do not start duplicate instances on the same ports. The launcher shares
`Ai:InternalKey` with Python through its environment and reads database/JWT keys
from existing User Secrets or equivalent environment variables.

A local demo Admin was registered as Customer and granted Admin through the
SQL method above. Its generated credentials are stored only in User Secrets as
`Member1Demo:AdminEmail` and `Member1Demo:AdminPassword`; view them privately in
your local secrets editor. They are not seeded or included in this repository.
These extra keys are for demo tooling, not application authentication configuration.

Opt-in real development-database checks (never use against production):

```sh
python3 scripts/verify-member1-local.py backend
python3 scripts/verify-member1-local.py browser
```

The browser check needs the three services running and Playwright Chromium installed
(`cd frontend && npx playwright install chromium`). It leaves a clearly labelled
inactive lawyer profile; custom test services and availability are removed on success.
If a test is interrupted, inspect and deactivate its labelled fixture through Admin.
The backend check commits no PostgreSQL test records. Neither command prints secrets.

Member 2 integration: use the unchanged LawyerId, own slot creation/reservations
and booking lifecycle, respect deactivated profiles, and coordinate changes to
periods with slots. Working-period results do not reserve capacity. If Member 2
writes availability directly, it must honor the same overlap/transaction rules.

Member 4 integration: call the recommendation service/subgraph, decide semantic
analysis improvements and workflow persistence, store returned traces, and keep
approval/global workflow ownership. Resolve the ADR/schema discrepancy together.

Remaining operational tasks: rotate exposed credentials; review historic Admin
accounts; validate any deployed environment separately; validate Android APK/device behavior; plan account invitations
for directory-only lawyer profiles. No Member 2/3/4 workflow is implemented here.

## Frontend authentication verification

See [AUTH_FIX.md](AUTH_FIX.md) for the public Login/Sign Up route fix and real
PostgreSQL browser results. To repeat the opt-in check with local services running:

```sh
python3 scripts/verify-member1-local.py auth
```

This creates a labelled Customer account. Admin credentials are loaded privately
from existing User Secrets; the existing in-memory token policy is preserved.

## Internal recommendation demo

Admins can open `/admin/recommendation-test` using **AI Recommendation** in the
existing navigation. See [RECOMMENDATION_DEMO.md](RECOMMENDATION_DEMO.md) for the
contract, UI behavior, limitations and real PostgreSQL browser verification.
