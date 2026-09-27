import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from lawyer_recommendation.gemini import GeminiClassifier, GeminiUnavailable, ParsedRequirement
from model_config import DEFAULT_GEMINI_MODEL


class GeminiClassificationTests(unittest.IsolatedAsyncioTestCase):
    def test_schema_accepted_by_gemini_and_unexpected_fields_rejected_locally(self):
        self.assertNotIn('additionalProperties', ParsedRequirement.model_json_schema())
        with self.assertRaises(ValueError):
            ParsedRequirement.model_validate({
                'requirement': 'Synthetic property dispute', 'lawyerId': 999,
            }, extra='forbid')

    async def test_uses_configured_model_and_structured_output(self):
        payload = {'requirement': 'Synthetic property dispute', 'categoryId': 3,
                   'categoryName': 'Property Law', 'location': None, 'preferredDate': None, 'keywords': ['property']}
        fake = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(
            generate_content=AsyncMock(return_value=SimpleNamespace(text=json.dumps(payload))))))
        with patch.dict('os.environ', {'GEMINI_API_KEY': 'test-only-key', 'GEMINI_MODEL': DEFAULT_GEMINI_MODEL}), \
             patch('google.genai.Client', return_value=fake):
            parsed = await GeminiClassifier().classify('Synthetic property dispute',
                [{'id': 3, 'name': 'Property Law'}], [])
        self.assertEqual(3, parsed['categoryId'])
        self.assertEqual(DEFAULT_GEMINI_MODEL, fake.aio.models.generate_content.call_args.kwargs['model'])
        self.assertEqual('application/json', fake.aio.models.generate_content.call_args.kwargs['config'].response_mime_type)

    async def test_invalid_json_fails_without_fabricating_category(self):
        fake = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(
            generate_content=AsyncMock(return_value=SimpleNamespace(text='not JSON')))))
        with patch.dict('os.environ', {'GEMINI_API_KEY': 'test-only-key'}), \
             patch('google.genai.Client', return_value=fake):
            with self.assertRaises(GeminiUnavailable):
                await GeminiClassifier().classify('Synthetic property dispute', [{'id': 3, 'name': 'Property Law'}], [])


if __name__ == '__main__':
    unittest.main()
