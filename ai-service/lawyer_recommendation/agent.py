"""Grounded, deterministic discovery graph. No legal advice or invented credentials."""
import re
from typing import Protocol, TypedDict
from langgraph.graph import StateGraph, START, END


class PlatformData(Protocol):
    async def catalogs(self) -> tuple[list[dict], list[dict]]: ...
    async def candidates(self, specialization_ids: list[int], service_ids: list[int], date: str | None = None) -> list[dict]:
        """Return stored candidates filtered to recorded working availability on date, if given."""
        ...


class State(TypedDict, total=False):
    requirement: str
    date: str | None
    limit: int
    specialization_ids: list[int]
    service_ids: list[int]
    candidates: list[dict]
    recommendations: list[dict]
    warnings: list[str]
    trace: list[dict]


def words(text: str) -> set[str]:
    # Inflection normalization only; meaning comes from stored catalog text.
    stop = {'the', 'and', 'for', 'with', 'law', 'legal', 'help', 'need', 'want', 'have', 'from', 'this', 'that', 'case', 'services', 'service'}
    return {w.removesuffix('s') for w in re.findall(r'[a-z]{3,}', text.lower()) if w not in stop}


def build_recommendation_graph(data: PlatformData):
    async def analyze(state: State):
        specs, services = await data.catalogs()
        query = words(state['requirement'])
        def matches(item):
            return bool(query & words(' '.join(str(item.get(k) or '') for k in ('name', 'description', 'category'))))
        spec_ids = [s['id'] for s in specs if matches(s)]
        service_ids = [s['id'] for s in services if matches(s)]
        return {'specialization_ids': spec_ids, 'service_ids': service_ids,
                'warnings': [] if spec_ids or service_ids else ['No catalog match. Please name a specialization or describe the requirement more specifically.'],
                'trace': [{'step': 'analyze', 'specializationIds': spec_ids, 'legalServiceIds': service_ids}]}

    async def retrieve(state: State):
        candidates = await data.candidates(state['specialization_ids'], state['service_ids'], state.get('date')) if state['specialization_ids'] or state['service_ids'] else []
        return {'candidates': candidates, 'trace': state['trace'] + [{'step': 'retrieve', 'candidateCount': len(candidates)}]}

    async def evaluate(state: State):
        results = []
        for lawyer in state['candidates']:
            if lawyer['status'] != 'Active':
                continue
            specs = [s['name'] for s in lawyer['specializations'] if s['id'] in state['specialization_ids']]
            services = [s['name'] for s in lawyer['legalServices'] if s['id'] in state['service_ids']]
            if not specs and not services:
                continue
            # The existing search API applies the date predicate in the database.
            available = bool(state.get('date'))
            reasons = []
            if specs: reasons.append('Specialization match: ' + ', '.join(specs))
            if services: reasons.append('Service match: ' + ', '.join(services))
            reasons.append(f"{lawyer['experience']} years of recorded experience")
            if available: reasons.append(f"Working availability recorded on {state['date']}; booking slot availability requires confirmation")
            score = 50 * len(specs) + 30 * len(services) + min(lawyer['experience'], 30) + (20 if available else 0)
            results.append({'lawyerId': lawyer['lawyerId'], 'score': score, 'reason': '. '.join(reasons) + '.'})
        results.sort(key=lambda r: (-r['score'], r['lawyerId']))
        return {'recommendations': results[:state.get('limit', 5)], 'trace': state['trace'] + [{'step': 'evaluate_and_rank', 'eligibleCount': len(results)}]}

    def validate(state: State):
        valid_ids = {l['lawyerId'] for l in state['candidates']}
        if any(r['lawyerId'] not in valid_ids for r in state['recommendations']):
            raise ValueError('Recommendation was not grounded in platform data')
        warnings = list(state['warnings'])
        if not state['recommendations'] and not warnings:
            warnings.append('No active lawyers match the requirement and requested date.')
        return {'warnings': warnings, 'trace': state['trace'] + [{'step': 'validate', 'passed': True}]}

    graph = StateGraph(State)
    for name, node in [('analyze', analyze), ('retrieve', retrieve), ('evaluate', evaluate), ('validate', validate)]:
        graph.add_node(name, node)
    graph.add_edge(START, 'analyze')
    graph.add_edge('analyze', 'retrieve')
    graph.add_edge('retrieve', 'evaluate')
    graph.add_edge('evaluate', 'validate')
    graph.add_edge('validate', END)
    return graph.compile()
