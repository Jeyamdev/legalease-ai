# Database configuration

Use the existing PostgreSQL database and migrations under
`backend/LegalService.API/Migrations`. Member 1 adds no database or migration.

Configure `ConnectionStrings__DefaultConnection` in the API process environment,
or use the API project's .NET user secrets. Never store credentials here.

The integrated code follows develop's current model: integer `Users.UserId` and
independent GUID `Lawyers.LawyerId`. Do not reapply the historical Member 1 GUID
user relationship assumptions. See `docs/member1/DEVELOP_INTEGRATION.md`.
