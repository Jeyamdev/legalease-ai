import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from lawyer_recommendation.app import app

class SnapshotTests(unittest.TestCase):
    def test_requires_internal_authentication(self):
        with patch.dict('os.environ', {'AI_INTERNAL_KEY': 'test-only-key'}), TestClient(app) as client:
            self.assertEqual(401, client.post('/lawyer-recommendations', json={'requirement': 'property'}).status_code)

    def test_ranks_only_matching_active_snapshot_candidates(self):
        payload = {
            'requirement': 'property dispute',
            'specializations': [{'id': 1, 'name': 'Property', 'description': 'Property disputes'}],
            'services': [],
            'candidates': [
                {'lawyerId': '00000000-0000-0000-0000-000000000001', 'status': 'Active', 'experience': 5, 'specializations': [{'id': 1, 'name': 'Property'}], 'legalServices': []},
                {'lawyerId': '00000000-0000-0000-0000-000000000002', 'status': 'Inactive', 'experience': 20, 'specializations': [{'id': 1, 'name': 'Property'}], 'legalServices': []},
            ],
        }
        with patch.dict('os.environ', {'AI_INTERNAL_KEY': 'test-only-key'}), TestClient(app) as client:
            response = client.post('/lawyer-recommendations', json=payload, headers={'X-Internal-Key': 'test-only-key'})
        self.assertEqual(200, response.status_code)
        result = response.json()['recommendations']
        self.assertEqual(1, len(result))
        self.assertEqual(payload['candidates'][0]['lawyerId'], result[0]['lawyerId'])
        self.assertEqual(55, result[0]['score'])
