# LegalEase AI

Intelligent legal-service platform developed as a collaborative Software Engineering project. The system combines a **.NET 8 / ASP.NET Core Web API**, **React** administration interface, **PostgreSQL**, a mobile client, and a separate **Python AI service**.

## Platform Overview

LegalEase is designed around legal-service discovery and management workflows. The repository contains backend, frontend, mobile, database, AI-service, documentation, and deployment-related components.

```text
backend/       ASP.NET Core Web API and business logic
frontend/      React web application
mobile/        Mobile application
ai-service/    Python AI workflows
database/      Database resources
docs/          Project documentation
scripts/       Supporting scripts
```

## My Contribution — Member 1

My assigned area is **Lawyer & Legal Service Management**. My work includes:

- Lawyer management and safe deactivation workflows
- Specialization and legal-service management
- Lawyer-specialization relationships
- Lawyer availability management with overlap/conflict validation
- Bookable-slot and public lawyer discovery/search workflows
- Search, filtering, sorting, and pagination
- Authentication/authorization integration for relevant workflows
- React-based administration functionality for lawyer management
- Mobile lawyer-discovery functionality
- Integration points with appointment and client workflows
- **AI-assisted Lawyer Recommendation** workflow

This is a group project. The repository contains work from multiple members; the items above describe my primary contribution.

## Lawyer Recommendation Agent

My Agentic AI feature assists with lawyer recommendations while keeping the final workflow controlled.

High-level flow:

```text
Client requirement
      ↓
Requirement classification
      ↓
Catalog validation
      ↓
Eligible lawyer search
      ↓
Deterministic ranking
      ↓
Validation / approval step
      ↓
Selection and downstream booking workflow
```

The AI component is used to interpret the requirement, while lawyer eligibility and ranking are constrained by application data and validation rather than relying only on free-form model output.

## Core Technologies

- **Backend:** C#, .NET 8, ASP.NET Core Web API, Entity Framework Core
- **Frontend:** React, Vite
- **Database:** PostgreSQL
- **AI service:** Python, FastAPI, LangGraph, Gemini integration
- **API style:** REST
- **Security:** JWT-based authentication and role-based authorization
- **Development:** Git/GitHub, API and database testing

## Engineering Areas Demonstrated

- REST API design and integration
- Relational data modelling with EF Core/PostgreSQL
- CRUD and validation workflows
- Authentication and authorization
- Search/filter/sort/pagination
- Availability and scheduling constraints
- Full-stack integration
- Controlled AI-assisted workflows
- Collaborative Git development

## Running the Project

This repository contains multiple services with separate dependencies and configuration. Review the service folders and project documentation before running locally. Environment-specific credentials and connection strings should be supplied through local configuration/environment variables rather than committed to source control.

The ASP.NET solution is available at:

```text
LegalService.sln
```

## Academic Project Note

LegalEase AI is an academic group project. Features and implementation ownership vary by member. This README intentionally distinguishes my Member 1 contribution from the complete platform so that the repository can be reviewed accurately.
