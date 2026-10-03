"""One structured Gemini call, limited to legal requirement understanding."""
import asyncio
import os
from datetime import date

from pydantic import BaseModel, Field
from model_config import DEFAULT_GEMINI_MODEL


class ParsedRequirement(BaseModel):
    requirement: str = Field(min_length=3, max_length=4000)
    categoryId: int | None = None
    categoryName: str | None = None
    location: str | None = None
    preferredDate: str | None = None
    keywords: list[str] = Field(default_factory=list, max_length=8)


class GeminiUnavailable(RuntimeError):
    pass


class GeminiClassifier:
    async def classify(self, requirement: str, categories: list[dict], services: list[dict]) -> dict:
        key = os.getenv('GEMINI_API_KEY', '').strip()
        if not key:
            raise GeminiUnavailable('Gemini API key is not configured')
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            raise GeminiUnavailable('Google GenAI SDK is not installed') from None

        prompt = (
            'You classify a legal issue for lawyer matching, not legal advice. Return structured data only. '
            'Choose categoryId and categoryName together from the supplied categories only when the legal issue clearly belongs to one. '
            'If the issue belongs to a legal field absent from the catalog, is nonsense, or is uncertain, return both null; do not choose the closest unrelated category. '
            'Never invent category IDs, lawyer IDs, lawyers, availability, or make a booking decision. '
            'Extract a preferredDate only if explicit and unambiguous; use ISO YYYY-MM-DD. '
            'Do not infer facts absent from the user text.\n'
            f'Today: {date.today().isoformat()}\nCategories: {categories}\nLegal services: {services}\n'
            f'User requirement: {requirement}'
        )
        try:
            client = genai.Client(api_key=key)
        except Exception:
            raise GeminiUnavailable('Gemini could not be initialized') from None
        for attempt in range(3):
            try:
                response = await asyncio.wait_for(client.aio.models.generate_content(
                    model=os.getenv('GEMINI_MODEL') or DEFAULT_GEMINI_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type='application/json',
                                                       response_schema=ParsedRequirement, temperature=0),
                ), timeout=20)
                return ParsedRequirement.model_validate_json(response.text, extra='forbid').model_dump()
            except Exception as exc:
                status = getattr(exc, 'code', None) or getattr(exc, 'status_code', None)
                temporary = isinstance(exc, (TimeoutError, ConnectionError)) or status in (429, 500, 502, 503, 504)
                if temporary and attempt < 2:
                    await asyncio.sleep(0.25 * (2 ** attempt))
                    continue
                if temporary:
                    raise GeminiUnavailable('Gemini is temporarily unavailable') from None
                raise GeminiUnavailable('Gemini returned an invalid structured requirement') from None
        raise GeminiUnavailable('Gemini is unavailable')
