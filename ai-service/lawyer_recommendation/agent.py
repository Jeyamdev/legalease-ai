"""Grounded lawyer discovery: Gemini parses language; Python owns every decision."""
from __future__ import annotations

from datetime import date
from typing import Protocol, TypedDict

from langgraph.graph import END, START, StateGraph


class PlatformData(Protocol):
    async def catalogs(self) -> tuple[list[dict], list[dict]]: ...
    async def candidates(self, specialization_ids: list[int], service_ids: list[int], date: str | None = None) -> list[dict]: ...


class Classifier(Protocol):
    async def classify(self, requirement: str, categories: list[dict], services: list[dict]) -> dict: ...


class InvalidClassification(ValueError):
    pass


class State(TypedDict, total=False):
    requirement: str
    date: str | None
    limit: int
    parsedRequirement: dict
    specialization_ids: list[int]
    service_ids: list[int]
    candidates: list[dict]
    recommendations: list[dict]
    warnings: list[str]
    trace: list[dict]
    status: str


def build_recommendation_graph(data: PlatformData, classifier: Classifier | None = None):
    if classifier is None:
        from .gemini import GeminiClassifier
        classifier = GeminiClassifier()

    async def parse_requirement(state: State):
        categories, services = await data.catalogs()
        parsed = await classifier.classify(state['requirement'], categories, services)
        return {'parsedRequirement': parsed, 'trace': [{'step': 'parse_requirement', 'status': 'completed'}]}

    async def validate_category(state: State):
        categories, services = await data.catalogs()
        parsed = state['parsedRequirement']
        category_id = parsed.get('categoryId')
        category_name = parsed.get('categoryName')
        if category_id is not None:
            matches = [c for c in categories if c['id'] == category_id and c['name'] == category_name]
            if len(matches) != 1:
                raise InvalidClassification('Gemini selected a category outside the current catalog')
        elif category_name is not None:
            raise InvalidClassification('Category name must be paired with a real category ID')
        parsed_date = parsed.get('preferredDate')
        if parsed_date is not None:
            try:
                date.fromisoformat(parsed_date)
            except (TypeError, ValueError):
                raise InvalidClassification('Gemini returned an invalid date') from None
        effective_date = state.get('date') or parsed_date
        service_ids = [s['id'] for s in services if category_id is not None and s.get('category') == category_name]
        warnings = []
        if category_id is None:
            warnings.append('The requirement did not match a known legal category. Please describe the issue more specifically.')
        if parsed.get('location'):
            warnings.append('Lawyer location is not recorded in this directory; location was not used for ranking.')
        return {'specialization_ids': [category_id] if category_id is not None else [],
                'service_ids': service_ids, 'date': effective_date, 'warnings': warnings,
                'trace': state['trace'] + [{'step': 'validate_category', 'categoryId': category_id, 'status': 'completed'}]}

    async def retrieve_lawyers(state: State):
        candidates = await data.candidates(state['specialization_ids'], state['service_ids'], state.get('date')) if state['specialization_ids'] else []
        return {'candidates': candidates, 'trace': state['trace'] + [{'step': 'search_lawyers', 'candidateCount': len(candidates)}]}

    def rank_candidates(state: State):
        ranked = []
        for lawyer in state['candidates']:
            if lawyer.get('status') != 'Active':
                continue
            specs = [s['name'] for s in lawyer.get('specializations', []) if s['id'] in state['specialization_ids']]
            services = [s['name'] for s in lawyer.get('legalServices', []) if s['id'] in state['service_ids']]
            if not specs:
                continue
            reasons = []
            if specs:
                reasons.append('Specialization match: ' + ', '.join(specs))
            if services:
                reasons.append('Service match: ' + ', '.join(services))
            experience = max(0, int(lawyer.get('experience') or 0))
            reasons.append(f'{experience} years of recorded experience')
            if state.get('date'):
                reasons.append(f"Unbooked slot recorded on {state['date']}; availability is rechecked at approval")
            score = 50 * len(specs) + 30 * len(services) + min(experience, 30) + (20 if state.get('date') else 0)
            ranked.append({'lawyerId': lawyer['lawyerId'], 'score': score, 'reason': '. '.join(reasons) + '.'})
        ranked.sort(key=lambda r: (-r['score'], r['lawyerId']))
        return {'recommendations': ranked[:state.get('limit', 5)],
                'trace': state['trace'] + [{'step': 'rank_candidates', 'eligibleCount': len(ranked)}]}

    def validate_recommendations(state: State):
        candidates = {l['lawyerId']: l for l in state['candidates']}
        validated = []
        for item in state['recommendations']:
            lawyer = candidates.get(item['lawyerId'])
            if not lawyer or lawyer.get('status') != 'Active':
                continue
            if not any(s['id'] in state['specialization_ids'] for s in lawyer.get('specializations', [])):
                continue
            if state.get('date') and state['date'] not in lawyer.get('availableDates', []):
                continue
            validated.append(item)
        warnings = list(state['warnings'])
        if not validated and not warnings:
            warnings.append('No eligible lawyers matched the requirement.')
        return {'recommendations': validated, 'warnings': warnings,
                'trace': state['trace'] + [{'step': 'validate_recommendations', 'validatedCount': len(validated)}]}

    def await_human_approval(state: State):
        status = 'AWAITING_APPROVAL' if state['recommendations'] else 'NO_MATCH'
        return {'status': status,
                'trace': state['trace'] + [{'step': 'await_human_approval', 'status': status}]}

    graph = StateGraph(State)
    for name, node in [('parse_requirement', parse_requirement), ('validate_category', validate_category),
                       ('retrieve_lawyers', retrieve_lawyers), ('rank_candidates', rank_candidates),
                       ('validate_recommendations', validate_recommendations),
                       ('await_human_approval', await_human_approval)]:
        graph.add_node(name, node)
    graph.add_edge(START, 'parse_requirement')
    graph.add_edge('parse_requirement', 'validate_category')
    graph.add_edge('validate_category', 'retrieve_lawyers')
    graph.add_edge('retrieve_lawyers', 'rank_candidates')
    graph.add_edge('rank_candidates', 'validate_recommendations')
    graph.add_edge('validate_recommendations', 'await_human_approval')
    graph.add_edge('await_human_approval', END)
    return graph.compile()
