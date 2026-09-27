import os
import unittest
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient
from lawyer_recommendation.app import app
from lawyer_recommendation.platform import HttpPlatformData


class TransportTests(unittest.IsolatedAsyncioTestCase):
    async def test_pagination_deduplicates_lawyers_across_matches(self):
        def handler(request):
            page = int(request.url.params['page'])
            return httpx.Response(200, json={'items': [{'lawyerId': str(page)}], 'totalCount': 2, 'pageSize': 1})
        async with httpx.AsyncClient(base_url='https://platform.test/api/', transport=httpx.MockTransport(handler)) as client:
            result = await HttpPlatformData(client).candidates([1], [2])
        self.assertEqual(['1', '2'], [r['lawyerId'] for r in result])

    async def test_candidate_limit_does_not_silently_truncate(self):
        async with httpx.AsyncClient(base_url='https://platform.test/api/', transport=httpx.MockTransport(lambda _: httpx.Response(200, json={'items': [], 'totalCount': 1001, 'pageSize': 100}))) as client:
            with self.assertRaises(ValueError):
                await HttpPlatformData(client).candidates([1], [])

    def test_internal_auth_and_request_validation(self):
        with patch.dict(os.environ, {'AI_INTERNAL_KEY': 'test-only-key'}), TestClient(app) as client:
            self.assertEqual(401, client.post('/lawyer-recommendations', json={'requirement': 'divorce'}).status_code)
            self.assertEqual(422, client.post('/lawyer-recommendations', headers={'X-Internal-Key': 'test-only-key'}, json={'requirement': 'x', 'limit': 100}).status_code)

    async def test_date_is_filtered_by_search_without_per_lawyer_requests(self):
        paths = []
        def handler(request):
            paths.append(request.url.path)
            self.assertEqual('2030-01-01', request.url.params['date'])
            return httpx.Response(200, json={'items': [{'lawyerId': str(i)} for i in range(100)], 'totalCount': 100, 'pageSize': 100})
        async with httpx.AsyncClient(base_url='https://platform.test/api/', transport=httpx.MockTransport(handler)) as client:
            result = await HttpPlatformData(client).candidates([2], [], '2030-01-01')
        self.assertEqual(100, len(result))
        self.assertEqual(['/api/lawyer-management/search'], paths)

    def test_blank_internal_requirement_is_rejected(self):
        with patch.dict(os.environ, {'AI_INTERNAL_KEY': 'test-only-key'}), TestClient(app) as client:
            response = client.post('/lawyer-recommendations', headers={'X-Internal-Key':'test-only-key'}, json={'requirement':'    '})
            self.assertEqual(422, response.status_code)
