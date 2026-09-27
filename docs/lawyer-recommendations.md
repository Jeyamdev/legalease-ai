# Lawyer recommendations on the existing directory

Open `/admin/lawyers`, sign in with the existing staff Admin account, and select
**AI Recommendation** beside **Add New Lawyer**. The expandable form stays on
that page. No shared navigation link or duplicate management/login API is needed.

The authenticated backend reads the existing specialization/service catalogs and
active lawyer records, filtering by recorded working availability when a date is
provided. It sends a snapshot to the internal Python service; the original
LangGraph workflow matches catalog words, ranks candidates, and checks identities.
The backend rechecks returned IDs and status before responding. This version does
not call an LLM. Scores are ranking points, not confidence probabilities.

Runtime configuration:

- Python dependencies: `ai-service/requirements-member1.txt`.
- Start in `ai-service`: `python -m uvicorn lawyer_recommendation.app:app --host 127.0.0.1 --port 8002`.
- Set Python `AI_INTERNAL_KEY` and backend `Ai__InternalKey` to the same private value.
- Set backend `Ai__BaseUrl=http://127.0.0.1:8002/`.
- Keep keys in process environments or your private configuration, never Git.
- POST `/api/lawyer-recommendations` requires the existing Admin JWT.

No schema changes or recommendation-related database writes are required. The
backend retains develop's existing startup seeder. The current local processes
use a temporary matching internal key; set both environments again after restart.

Validated: backend/frontend builds; six Python workflow/transport tests; live
Admin login and recommendation request (200); unauthenticated request (401).
