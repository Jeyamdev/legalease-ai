> Historical notes from before the develop integration. See [DEVELOP_INTEGRATION.md](DEVELOP_INTEGRATION.md) for current routes, schema, setup, and validation.

# Member 1 file inventory

## Existing files modified

- `.gitignore`
- `backend/LegalService.API/Controllers/AuthController.cs`
- `backend/LegalService.API/DTOs/Requests/LoginRequest.cs`
- `backend/LegalService.API/DTOs/Requests/RegisterRequest.cs`
- `backend/LegalService.API/LegalService.API.csproj`
- `backend/LegalService.API/Program.cs`
- `backend/LegalService.API/appsettings.json`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/components/common/ServicesSection.tsx`
- Removed obsolete root credential file (filename redacted).

## New files

```text
ai-service/.env.example
ai-service/lawyer_recommendation/__init__.py
ai-service/lawyer_recommendation/agent.py
ai-service/lawyer_recommendation/app.py
ai-service/lawyer_recommendation/platform.py
ai-service/requirements.lock.txt
ai-service/requirements.txt
ai-service/tests/test_recommendation.py
ai-service/tests/test_transport.py
backend/LegalService.API.Tests/LawyerTests.cs
backend/LegalService.API.Tests/LegalService.API.Tests.csproj
backend/LegalService.API/Authentication/Services/TokenService.cs
backend/LegalService.API/Controllers/LawyerRecommendationsController.cs
backend/LegalService.API/Controllers/LawyersController.cs
backend/LegalService.API/Controllers/LegalServicesController.cs
backend/LegalService.API/Controllers/SpecializationsController.cs
backend/LegalService.API/DTOs/Requests/LawyerRequests.cs
backend/LegalService.API/DTOs/Responses/LawyerResponses.cs
backend/LegalService.API/Infrastructure/ApiException.cs
backend/LegalService.API/Services/Lawyers/CatalogService.cs
backend/LegalService.API/Services/Lawyers/ILawyerService.cs
backend/LegalService.API/Services/Lawyers/LawyerService.cs
backend/LegalService.API/Services/Lawyers/RecommendationService.cs
database/README.md
docs/member1/FILES.md
docs/member1/README.md
docs/member1/VALIDATION.md
frontend/.env.example
frontend/playwright.config.ts
frontend/src/features/lawyers/api/client.ts
frontend/src/features/lawyers/api/lawyers.ts
frontend/src/features/lawyers/components/AvailabilityManager.tsx
frontend/src/features/lawyers/components/LawyerForm.tsx
frontend/src/features/lawyers/components/Shared.tsx
frontend/src/features/lawyers/hooks/session.ts
frontend/src/features/lawyers/hooks/useResource.ts
frontend/src/features/lawyers/pages/AdminLoginPage.tsx
frontend/src/features/lawyers/pages/CatalogPage.tsx
frontend/src/features/lawyers/pages/LawyerDetailPage.tsx
frontend/src/features/lawyers/pages/LawyerEditorPage.tsx
frontend/src/features/lawyers/pages/LawyerListPage.tsx
frontend/src/features/lawyers/schemas/index.ts
frontend/src/features/lawyers/types/index.ts
frontend/tests/lawyer-management.spec.ts
mobile/.gitignore
mobile/.metadata
mobile/README.md
mobile/analysis_options.yaml
mobile/android/.gitignore
mobile/android/app/build.gradle.kts
mobile/android/app/src/main/AndroidManifest.xml
mobile/android/app/src/main/kotlin/com/example/legal_service_mobile/MainActivity.kt
mobile/android/app/src/main/res/drawable-v21/launch_background.xml
mobile/android/app/src/main/res/drawable/launch_background.xml
mobile/android/app/src/main/res/mipmap-hdpi/ic_launcher.png
mobile/android/app/src/main/res/mipmap-mdpi/ic_launcher.png
mobile/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
mobile/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
mobile/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
mobile/android/app/src/main/res/values-night/styles.xml
mobile/android/app/src/main/res/values/styles.xml
mobile/android/app/src/profile/AndroidManifest.xml
mobile/android/build.gradle.kts
mobile/android/gradle.properties
mobile/android/gradle/wrapper/gradle-wrapper.properties
mobile/android/settings.gradle.kts
mobile/lib/features/lawyers/lawyer_api.dart
mobile/lib/features/lawyers/lawyer_store.dart
mobile/lib/features/lawyers/models.dart
mobile/lib/features/lawyers/screens.dart
mobile/lib/features/lawyers/widgets.dart
mobile/lib/main.dart
mobile/pubspec.lock
mobile/pubspec.yaml
mobile/test/lawyer_store_test.dart
mobile/test/widget_test.dart
mobile/web/favicon.png
mobile/web/icons/Icon-192.png
mobile/web/icons/Icon-512.png
mobile/web/icons/Icon-maskable-192.png
mobile/web/icons/Icon-maskable-512.png
mobile/web/index.html
mobile/web/manifest.json
```

Generated build/test/cache output is ignored. Existing entities, DbContext, migrations, and ADRs are unchanged.

## September 25 local integration additions

- `backend/LegalService.API.Tests/PostgresRelationshipTests.cs`
- `frontend/integration/member1-live.mjs`
- `scripts/start-member1-local.py`
- `scripts/verify-member1-local.py`
- `docs/member1/INTEGRATION.md`

Development CORS and README were updated. No migrations, entities, or DbContext
were changed. See INTEGRATION.md for local-only configuration and executed checks.
