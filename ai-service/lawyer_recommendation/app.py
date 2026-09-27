import asyncio
import os
import secrets
from datetime import date as Date
from uuid import UUID
import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from .agent import InvalidClassification, build_recommendation_graph
from .gemini import GeminiUnavailable, ParsedRequirement


app = FastAPI(title='Member 1 Lawyer Recommendation', docs_url=None, redoc_url=None)


class RecommendationRequest(BaseModel):
    specializations: list[dict] = Field(default_factory=list)
    services: list[dict] = Field(default_factory=list)
    candidates: list[dict] = Field(default_factory=list)
    requirement: str = Field(min_length=3, max_length=4000)
    @field_validator('requirement')
    @classmethod
    def requirement_not_blank(cls, value: str) -> str:
        if len(value.strip()) < 3:
            raise ValueError('Requirement must contain at least three non-padding characters')
        return value.strip()

    date: Date | None = None
    limit: int = Field(default=5, ge=1, le=20)


class Recommendation(BaseModel):
    lawyerId: UUID
    score: int
    reason: str


class RecommendationResponse(BaseModel):
    recommendations: list[Recommendation]
    warnings: list[str]
    trace: list[dict]
    parsedRequirement: ParsedRequirement
    date: Date | None = None


@app.post('/lawyer-recommendations', response_model=RecommendationResponse)
async def recommend(request: RecommendationRequest, x_internal_key: str = Header(default='')):
    key = os.environ.get('AI_INTERNAL_KEY', '')
    if not key or not secrets.compare_digest(key, x_internal_key):
        raise HTTPException(401, 'Internal authentication required')
    # Only the authenticated backend supplies the database snapshot. No browser data
    # or model-generated lawyer identities are trusted as candidates.
    class SnapshotData:
        async def catalogs(self):
            return request.specializations, request.services

        async def candidates(self, specialization_ids, service_ids, date=None):
            return [lawyer for lawyer in request.candidates
                    if (any(s['id'] in specialization_ids for s in lawyer['specializations'])
                        or any(s['id'] in service_ids for s in lawyer['legalServices']))
                    and (not date or date in lawyer.get('availableDates', []))]

    try:
        graph = build_recommendation_graph(SnapshotData())
        result = await asyncio.wait_for(graph.ainvoke({
            'requirement': request.requirement,
            'date': request.date.isoformat() if request.date else None,
            'limit': request.limit,
        }), timeout=40)
        return {k: result[k] for k in ('recommendations', 'warnings', 'trace', 'parsedRequirement', 'date')}
    except InvalidClassification:
        raise HTTPException(422, 'The legal category could not be validated. Please refine the requirement.') from None
    except GeminiUnavailable:
        raise HTTPException(503, 'Requirement understanding is temporarily unavailable') from None
    except ValueError:
        raise HTTPException(422, 'Unable to rank candidates. Refine the requirement.') from None
    except (httpx.HTTPError, TimeoutError):
        raise HTTPException(503, 'Platform discovery is temporarily unavailable') from None
