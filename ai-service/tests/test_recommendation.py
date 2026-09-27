import unittest
from lawyer_recommendation.agent import build_recommendation_graph


class Data:
    async def catalogs(self):
        return [{'id': 2, 'name': 'Family Law', 'description': 'Divorce and custody'}], [{'id': 2, 'name': 'Divorce filing', 'description': '', 'category': 'Family Law'}]

    async def candidates(self, specialization_ids, service_ids, date=None):
        return [dict(lawyerId=str(i), status=status, experience=experience,
                     specializations=[{'id': 2, 'name': 'Family Law'}], legalServices=[])
                for i, status, experience in [(1, 'Active', 10), (2, 'Inactive', 30), (3, 'Active', 2)]
                if not date or (date == '2030-01-01' and i == 3)]


class AgentTests(unittest.IsolatedAsyncioTestCase):
    async def test_grounded_ranking_excludes_inactive(self):
        result = await build_recommendation_graph(Data()).ainvoke({'requirement': 'divorce', 'limit': 5})
        self.assertEqual(['1', '3'], [r['lawyerId'] for r in result['recommendations']])
        self.assertIn('Family Law', result['recommendations'][0]['reason'])
        self.assertEqual('validate', result['trace'][-1]['step'])

    async def test_date_requires_recorded_availability(self):
        result = await build_recommendation_graph(Data()).ainvoke({'requirement': 'custody', 'date': '2030-01-01'})
        self.assertEqual(['3'], [r['lawyerId'] for r in result['recommendations']])
        self.assertIn('requires confirmation', result['recommendations'][0]['reason'])

    async def test_unmatched_requirement_requests_clarification(self):
        result = await build_recommendation_graph(Data()).ainvoke({'requirement': 'unrecognized topic'})
        self.assertEqual([], result['recommendations'])
        self.assertTrue(result['warnings'])

    async def test_no_available_candidates(self):
        result = await build_recommendation_graph(Data()).ainvoke({'requirement': 'divorce', 'date': '2030-02-02'})
        self.assertEqual([], result['recommendations'])
        self.assertTrue(result['warnings'])


if __name__ == '__main__':
    unittest.main()
