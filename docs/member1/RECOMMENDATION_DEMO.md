> Historical notes from before the develop integration. See [DEVELOP_INTEGRATION.md](DEVELOP_INTEGRATION.md) for current routes, schema, setup, and validation.

# Lawyer Recommendation Agent demo page

Open `http://127.0.0.1:5173/admin/recommendation-test` after Admin login, or select
**AI Recommendation** in the existing Admin navigation. This is Member 1's
internal discovery demonstration, not Member 4's customer/planning/workflow UI.

## Contract and authentication

Existing `POST /api/lawyer-recommendations`:

```json
{"requirement":"I need help with a property ownership dispute.","date":"2030-03-03","limit":5}
```

Requirement is trimmed, 3–4000 characters. Date is optional (omitted when blank).
The API accepts limits 1–20; the demo offers 3, 5 and 10.

Response shape (types, not example lawyer data):

```text
{
  recommendations: [{ lawyerId: GUID, score: integer, reason: string }],
  warnings: string[],
  trace: JSON[]
}
```

The backend requires authentication and continues accepting authenticated Customers
through its existing endpoint. Only this internal page is Admin-only, via the
existing AdminLayout guard. Axios gets the Bearer token from the existing in-memory
Zustand session and uses VITE_API_BASE_URL. A 401 clears that session and redirects
through the existing guard. No new credentials/storage/auth system was introduced.

## UI behavior

Enter a requirement or populate it using an example chip (never auto-submits),
optionally select a date, choose a limit, and submit. The page shows a simple
static discovery sequence, loading state, returned warnings, result cards, an
explicit no-match state, or an error. Duplicate submissions are guarded and pending
requests are aborted when leaving the page. The recommendation call has a 60-second
client timeout to accommodate the existing 45-second API gateway timeout.

The endpoint returns IDs only, so the API helper fetches those existing lawyer
details in parallel (at most ten); it does not download the whole lawyer directory.
There is no existing batch-ID endpoint. Cards display actual name, experience,
status, specializations, legal services, recommendation score and reason. Stale
Inactive profiles are excluded. A failed detail read shows an error rather than
inventing a profile. Availability is not independently asserted by the UI; any
availability explanation is the agent's returned text. Scores are raw ranking
scores, not percentages, ratings, success rates or confidence measures.

View Lawyer opens `/admin/lawyers/{id}`. No duplicate profile page is introduced.
No trace/audit-history dashboard is rendered. The legal-advice disclaimer is visible.
The existing agent remains a lexical catalog matcher, not an LLM chatbot.

## Changes

Created under `frontend/src/features/lawyers/recommendations/`:

- `RecommendationPage.tsx`
- `RecommendationCard.tsx`
- `schema.ts`
- `api.ts`

Also created `frontend/tests/recommendation.spec.ts` and this guide.
Modified `frontend/src/App.tsx`, the existing Admin navigation in
`frontend/src/features/lawyers/components/Shared.tsx`, and the existing live-browser
script `frontend/integration/member1-live.mjs`. README links to this guide.
No backend, migration, database schema, AI implementation, or other-member workflow
was modified.

## Verification — September 25, 2026

- `npm run build`: passed, TypeScript/Vite.
- `npm run lint`: passed.
- `npm test`: all 13 tests passed. Four focused tests cover authentication,
  validation, optional date/limit/request payload, Bearer header, examples,
  duplicate-submit protection/loading, returned fields, profile navigation,
  warnings, empty results, stale Inactive details and API errors. Existing auth
  and lawyer CRUD UI regression tests also passed.
- `python3 scripts/verify-member1-local.py browser`: passed against real PostgreSQL,
  ASP.NET and the recommendation service, without API mocks or browser errors.
  A labelled Active lawyer with a property specialization, service and availability
  was created through the Admin UI. Its recommendation appeared on this page with
  the request JWT attached. View Lawyer worked. After safe deactivation it no longer
  appeared. “I need help with something completely unrelated.” returned no lawyers.
- Layout checked at 390, 768 and 1280 pixel widths with no horizontal overflow.
- `/`, `/login`, `/signup`, `/admin/login`, `/admin/lawyers` returned HTTP 200.
  Login and Admin Lawyer Management were exercised in the live browser flow.
- GET `/api/lawyers`, `/api/lawyers/search`, `/api/specializations`, and
  `/api/legal-services` returned 200 against PostgreSQL.

The initial live attempt found stopped services; the existing local launcher
started them. One subsequent test selector needed adjustment for the accessible
View Lawyer name; the corrected full flow passed. Test lawyers were safely
deactivated, and only their temporary services/availability were removed, including
the interrupted fixture. Demo Admin credentials remained private in User Secrets.

Services were left running. For future starts use `python3 scripts/start-member1-local.py`
from the repository root. Do not start a second copy while ports are occupied.
For your viva, create or activate your own appropriate profile and associations;
test fixtures were not left active. An empty response is expected without a matching
active lawyer. Recorded working periods do not guarantee unbooked appointment slots.
