> Historical notes from before the develop integration. See [DEVELOP_INTEGRATION.md](DEVELOP_INTEGRATION.md) for current routes, schema, setup, and validation.

# Strict Member 1 review — 23 September 2026

Scope: current feature branch compared with `main`, including untracked Member 1
source. No new features, entity/schema changes, commits, pushes, or merges.

## Confirmed defects fixed

| Severity | Finding | Fix / regression coverage |
|---|---|---|
| Medium | A dated recommendation fetched availability separately for every candidate (up to 1,000 sequential HTTP calls, each generating DB queries). | Pass the date to the existing search API; filter in the database. Removed the unused per-lawyer availability tool. Added a transport regression proving 100 candidates require one search call. |
| Medium | Upstream JSON containing a null recommendation caused a null-reference 500; missing reason/invalid score/empty ID was not rejected at the gateway boundary. | Validate recommendation entries and return 502 for malformed responses. Added gateway tests for malformed responses, nonexistent/inactive lawyers, valid stored IDs and upstream failure. |
| Medium | React's availability schema accepted clock values such as 25:00 and considered 09:00 and 09:00:00 different times. | Validate clock ranges and compare normalized numeric times. Added schema regression cases. |
| Medium | Availability editing truncated seconds before saving, changing a stored period even when an admin did not edit its times. | Preserve stored precision in form defaults and allow time-input precision. Extended browser regression to check edit/save of 09:00:30. |
| Medium | Browser Back restored a previous search URL/results but left the text field showing the newer search. | Key the draft search form to the committed URL search value. Added Back-navigation regression. |
| Low | React accepted digit-free phone punctuation and more associations than the API's 100-ID maximum. | Require a digit and align association limits with the API; added schema checks. |
| Low | Lawyer update eagerly joined both many-to-many collections, creating a multiplicative row result. | Use split queries inside the existing transaction. Reads already used split projections; no per-row EF query pattern was found. |
| Low | Internal Python requests accepted a whitespace-only requirement; the callable C# service did not itself validate its input. | Reject blank/short trimmed Python input and invoke DTO validation at the C# service boundary. |
| Low | Shared registration's async DB calls did not propagate request cancellation. | Propagate CancellationToken; retain existing registration response semantics. |

## Checks of the original requirements

- No changes to existing domain entities, DbContext, migrations or ADRs relative
  to main. Shared GUID LawyerId/User identity and appointment foreign keys remain.
- No booking lifecycle, documentation/clerk/career logic, or global coordinator/
  approval workflow was added or changed. Authentication/startup/routing remain
  the necessary shared integration changes documented in the original handover.
- Admin mutation attributes are present on lawyer/catalog/availability writes;
  public discovery visibility remains restricted to active profiles/accounts.
  JWT validation, role reloads and blocked public Admin registration remain intact.
- DTO validation covers required names, emails, phones, experience, licenses,
  statuses, associations, pagination, and time ordering. No exposed EF entity
  return was found in the new endpoints. Public nonmatches/missing IDs, mutation
  conflicts and authorization responses have appropriate status mappings.
- Member 1 database I/O is async. Projection/in-memory collection `ToList()` calls
  are not synchronous database round trips. No new schema migration is needed.
- No hardcoded backend URL in React components or Flutter screens. Runtime client
  URLs are configured; local URLs in examples/configuration/tests are intentional.
- Axios, RHF/Zod, Zustand, Provider and LangGraph follow the existing ADR choices;
  no duplicate ASP.NET/React app, database, or competing state framework appeared.
- Recommendation IDs originate in platform data and are rechecked by the gateway.
  The deterministic graph does not invent reviews, credentials, or success rates.
- A secret-pattern scan of tracked and new non-ignored text files found no matches.
  This does not clear old Git history or inspect external user-secret stores.

## Validation executed during this review

| Command/check | Current result |
|---|---|
| `dotnet build backend/LegalService.API.Tests/LegalService.API.Tests.csproj --no-restore` | Passed; builds API and all backend tests, zero warnings/errors |
| `npm run build` | Passed, TypeScript + Vite |
| `npm run lint` | Passed |
| Isolated Node assertions against the actual Zod schemas | 8 passed; no browser/server needed |
| `.venv/bin/python -m unittest discover -s tests -v` | 9 passed |
| `git diff --check` | Passed |
| Domain/DbContext/migration/ADR comparison against main | No changes |
| Credential-pattern scan (values never printed) | No matches in scanned working-tree source |

Full backend restore/test, browser tests, and Flutter analyze/test/web-build
commands were submitted but rejected before execution by automatic approval
review: its refresh token was revoked and it requires sign-out/sign-in. A reduced,
sandbox-only Flutter analysis attempt also failed before analysis because the
SDK tried to access its telemetry file outside the allowed workspace. The
rejection was not bypassed. No new full-suite or mobile pass is claimed here.
The earlier 22 September green run remains historical and does not validate the
new backend/browser regressions added during this review.

## Manual PR gate / unresolved limitations

1. Restore the approval session, then rerun:
   - `dotnet restore backend/LegalService.API.Tests/LegalService.API.Tests.csproj`
   - `dotnet test backend/LegalService.API.Tests/LegalService.API.Tests.csproj --no-restore`
   - In frontend: `npm test`
   - In mobile: `flutter analyze`, `flutter test`, `flutter build web`, and an
     Android build/device test with the appropriate Android SDK.
2. Use an approved development PostgreSQL instance to test Npgsql translations,
   concurrent overlaps, duplicate writes, and races with Member 2 slot creation.
   SQLite tests cannot establish PostgreSQL serialization behavior. Do not apply
   migrations to the shared database as part of this review.
3. Confirm credential rotation and history cleanup. The previously exposed
   database secret remains a concern until its owner rotates it. Review historic
   privileged users created before the public-registration restriction.
4. Coordinate shared authentication changes and supported status values with the
   team. New profile-only accounts intentionally have no login password.
5. Review recommendation suitability with realistic and negated/multilingual
   requirements. Lexical catalog matching cannot understand such intent reliably.
   Working availability is not a guarantee of unbooked slots. These remain
   documented limitations; this review did not introduce semantic AI or booking.
6. Member 2 should resolve the pre-existing nullable shadow LawyerId relationship
   on AvailabilitySlot. Member 4 should resolve the pre-existing ADR-004 versus
   workflow-entity discrepancy and persist returned traces. Neither was rewritten.
7. Android scaffolding currently uses the example application ID and debug signing
   for release builds. Set the intended application ID and proper signing before
   distributing a production APK. No signing key is in the repository.
8. An empty untracked `backend/LegalService.API/package-lock.json` was present at
   the start of this review. It has no associated Node project and should be
   excluded from the PR. It was left untouched as an unrelated local addition.
