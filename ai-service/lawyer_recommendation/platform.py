import httpx


class HttpPlatformData:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def get(self, path, params=None):
        response = await self.client.get(path, params=params)
        response.raise_for_status()
        return response.json()

    async def catalogs(self):
        return await self.get('specializations'), await self.get('legal-services')

    async def candidates(self, specialization_ids, service_ids, date=None):
        found = {}
        filters = [('specializationId', i) for i in specialization_ids] + [('legalServiceId', i) for i in service_ids]
        for field, value in filters:
            page = 1
            while True:
                params = {field: value, 'page': page, 'pageSize': 100, 'status': 'Active'}
                if date:
                    params['date'] = date
                result = await self.get('lawyer-management/search', params)
                found.update({item['lawyerId']: item for item in result['items']})
                if result['totalCount'] > 1000 or len(found) > 1000:
                    # Never silently rank an arbitrary truncated subset.
                    raise ValueError('Too many matches. Refine the legal requirement.')
                if page * result['pageSize'] >= result['totalCount']:
                    break
                page += 1
        return list(found.values())
