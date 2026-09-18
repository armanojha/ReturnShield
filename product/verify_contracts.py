"""Offline contract acceptance checks, not application or AWS runtime tests.

Run: python docs/product/verify_contracts.py
Requires jsonschema 4.x and referencing (already available in authoring environment).
"""
import copy
import hashlib
import json
from datetime import datetime
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'docs/contracts'
URI = 'https://returnshield.example/contracts/'
schemas = {p: json.loads(p.read_text(encoding='utf-8')) for p in BASE.rglob('*.schema.json')}
registry = Registry().with_resources((s['$id'], Resource.from_contents(s)) for s in schemas.values())
checks = 0
formats = FormatChecker()

@formats.checks('date-time', raises=ValueError)
def utc_timestamp(value):
    if not isinstance(value, str):
        return True
    return value.endswith('Z') and datetime.fromisoformat(value.replace('Z', '+00:00')).utcoffset().total_seconds() == 0

def check(condition, message):
    global checks
    assert condition, message
    checks += 1

def validate(group, name, value):
    Draft202012Validator({'$ref': URI + group + '.schema.json#/$defs/' + name}, registry=registry, format_checker=formats).validate(value)
    global checks
    checks += 1

def rejects(group, name, value):
    from jsonschema.exceptions import ValidationError
    try:
        validate(group, name, value)
    except ValidationError:
        global checks
        checks += 1
        return
    raise AssertionError(f'{name} accepted invalid fixture')

def refs(value):
    if isinstance(value, dict):
        if '$ref' in value:
            registry.resolver().lookup(value['$ref'])
            check(True, 'Reference resolution')
        for child in value.values(): refs(child)
    elif isinstance(value, list):
        for child in value: refs(child)

for s in schemas.values():
    Draft202012Validator.check_schema(s)
    refs(s)
    for name, definition in s['$defs'].items():
        # HTTP envelope and named query schema have explicitly documented versioning.
        if name != 'CaseQuery':
            check('schema_version' in definition['required'], f'{name} lacks schema_version')
            check(definition['additionalProperties'] is False, f'{name} is open-ended')

api = json.loads((BASE / 'api/openapi.json').read_text())
refs(api)
check(sum(len(v) for v in api['paths'].values()) == 9, 'Endpoint inventory')
operations = [op['operationId'] for methods in api['paths'].values() for op in methods.values()]
check(len(set(operations)) == 9, 'Unique operation IDs')
policy = json.loads((BASE / 'risk/policy.json').read_text())
check([r['max'] for r in policy['signals']] == [30, 25, 20, 20, 15], 'Source weights')

def route(score):
    matches = [r for r in policy['thresholds'] if r['min'] <= score <= r['max']]
    check(len(matches) == 1, 'Unambiguous threshold')
    return matches[0]['decision'], matches[0]['priority']

for score in range(101): route(score)
for score, expected in [(0, ('AUTO_APPROVE', 'NONE')), (29, ('AUTO_APPROVE', 'NONE')), (30, ('NEEDS_REVIEW', 'NORMAL')), (59, ('NEEDS_REVIEW', 'NORMAL')), (60, ('NEEDS_REVIEW', 'HIGH')), (100, ('NEEDS_REVIEW', 'HIGH'))]:
    check(route(score) == expected, 'Boundary truth')

stories = json.loads((BASE / 'seeds/stories.json').read_text())['stories']
check([s['story_id'] for s in stories] == ['clean', 'review', 'high'], 'Three stories')
for story, expected in zip(stories, [(0, 0), (45, 45), (110, 100)]):
    seller, listing, customer, order = [story[n] for n in ['seller', 'listing', 'customer', 'order']]
    case, result = story['expected_case'], story['expected_risk_result']
    for name in ['Seller', 'Listing', 'Customer', 'Order']: validate('data/entities', name, story[name.lower()])
    validate('data/entities', 'ReturnCase', case)
    validate('api/http', 'ReturnRequest', story['request'])
    validate('risk/evaluation', 'Result', result)
    flags = [seller['return_rate'] >= .20 or seller['dispute_count'] >= 3, listing['status'] == 'CORRECTION_REQUIRED', customer['recent_returns'] >= 3, story['request']['reason'] == 'NOT_RECEIVED' and order['status'] == 'DELIVERED', listing['category'] == 'ELECTRONICS']
    points = [r['max'] if flag else 0 for r, flag in zip(policy['signals'], flags)]
    check(points == [e['contribution'] for e in case['contributions']], 'Predicate truth')
    check((sum(points), min(100, max(0, sum(points)))) == expected, 'Exact seed outcome')
    check(expected == (case['raw_contribution_total'], case['risk_score']), 'Case score truth')
    check(route(case['risk_score']) == (case['decision'], case['priority']), 'Case route')
    check(result['score'] == case['risk_score'], 'Risk to case mapping')
    check(result['raw_contribution_total'] == case['raw_contribution_total'], 'Raw mapping')
    check(len({e['signal'] for e in case['contributions']}) == 5, 'Five distinct signals')
    for field in ['seller_id', 'listing_id', 'customer_id', 'order_id']:
        check(case[field] == order[field], 'Case/order relationship')
    check(order['seller_id'] == seller['seller_id'] == listing['seller_id'], 'Seller relationship')
    check(order['listing_id'] == listing['listing_id'], 'Listing relationship')
    check(order['customer_id'] == customer['customer_id'], 'Customer relationship')
    check(customer['recent_returns'] <= customer['return_count'], 'History counts')
    check(order['delivered_at'] >= order['timestamp'], 'Delivery chronology')
    check(listing['status'] == listing['analysis']['status'] and listing['listing_risk'] == listing['analysis']['severity'], 'Listing mapping')
    evidence_ids = {e['evidence_id'] for e in case['evidence']}
    check(len(evidence_ids) == len(case['evidence']), 'Unique evidence')
    for e in case['contributions']:
        validate('data/entities', 'RiskEvent', e)
        check(e['case_id'] == case['case_id'] and set(e['evidence_refs']) <= evidence_ids, 'Signal grounding')
    for e in listing['analysis']['evidence']:
        check(e['quote'] in listing[e['field']], 'Listing quote grounding')
    lg_ids = {e['evidence_id'] for e in listing['analysis']['evidence']}
    for issue in listing['analysis']['issues']: check(set(issue['evidence_refs']) <= lg_ids, 'Issue grounding')
    validate('ai/models', 'ListingGuardInput', {'schema_version': '1.0.0', **{k: listing[k] for k in ['title', 'description', 'category']}})
    if case['explanation']:
        validate('ai/models', 'InvestigatorInput', {'schema_version': '1.0.0', 'case_id': case['case_id'], 'policy_result': result, 'evidence': case['evidence'], 'allowed_evidence_ids': sorted(evidence_ids)})
        for factor in case['explanation']['factors']: check(set(factor['evidence_refs']) <= evidence_ids, 'Investigator grounding')
        validate('ai/models', 'ReviewEvent', {'schema_version': '1.0.0', 'event_type': 'RETURN_NEEDS_REVIEW', 'event_id': 'EVENT-' + story['story_id'], **{k: case[k] for k in ['case_id', 'order_id', 'seller_id', 'listing_id', 'policy_version', 'risk_score', 'priority']}, 'occurred_at': story['evaluation_at']})

case = stories[1]['expected_case']
def envelope(data): return {'schema_version': '1.0.0', 'correlation_id': 'CORR-test', 'data': data}
samples = {
    'HealthResponse': {'service': 'returnshield', 'status': 'ok'},
    'ListingResponse': stories[0]['listing'], 'ReturnResponse': {'case': case, 'replayed': False},
    'CaseResponse': case, 'SellerResponse': stories[0]['seller'],
    'CasesResponse': {'items': [s['expected_case'] for s in stories], 'next_cursor': None},
    'DashboardResponse': {'as_of': stories[0]['evaluation_at'], 'flagged_listings': 1, 'auto_approved_returns': 1, 'normal_review_cases': 1, 'high_review_cases': 1, 'open_review_cases': 2, 'missing_context_cases': 0},
    'DecisionResponse': case,
}
for name, data in samples.items(): validate('api/http', name, envelope(data))
validate('api/http', 'ListingRequest', {'schema_version': '1.0.0', **{k: stories[0]['listing'][k] for k in ['listing_id', 'seller_id', 'title', 'description', 'category']}})
validate('api/http', 'DecisionRequest', {'schema_version': '1.0.0', 'expected_revision': 4, 'action': 'APPROVE_RETURN', 'note': 'Evidence reviewed.'})
validate('api/http', 'CaseQuery', {})
validate('api/http', 'Error', {'schema_version': '1.0.0', 'correlation_id': 'CORR-test', 'error': {'code': 'ERROR_MISSING_CONTEXT', 'message': 'Seller history missing.', 'retryable': False, 'details': [{'field': 'seller', 'message': 'Not available.'}]}})

# Meaningful rejection fixtures guard schema safety boundaries.
bad = copy.deepcopy(stories[0]['listing']['analysis']); bad['risk_score'] = 0
rejects('ai/models', 'ListingGuardOutput', bad)
bad = copy.deepcopy(stories[0]['listing']['analysis']); bad['severity'] = 'high'
rejects('ai/models', 'ListingGuardOutput', bad)
bad = copy.deepcopy(case['explanation']); bad['decision'] = 'AUTO_APPROVE'
rejects('ai/models', 'InvestigatorOutput', bad)
bad = copy.deepcopy(case); bad['priority'] = 'HIGH'
rejects('data/entities', 'ReturnCase', bad)
bad = copy.deepcopy(case); bad['schema_version'] = '2.0.0'
rejects('data/entities', 'ReturnCase', bad)
bad = copy.deepcopy(case); bad['risk_score'] = 101
rejects('data/entities', 'ReturnCase', bad)
bad = copy.deepcopy(case); bad['created_at'] = 'yesterday'
rejects('data/entities', 'ReturnCase', bad)
rejects('api/http', 'ReturnRequest', {'schema_version': '1.0.0', 'order_id': 'ORDER-clean', 'reason': 'UNKNOWN', 'evidence': []})
rejects('api/http', 'CaseQuery', {'limit': 101})

missing = copy.deepcopy(case)
missing.update(status='ERROR_MISSING_CONTEXT', raw_contribution_total=None, risk_score=None, decision=None, priority=None, review_status='NOT_APPLICABLE', reviewer_disposition=None, explanation_status='NOT_REQUESTED', explanation=None,
    error={'code': 'ERROR_MISSING_CONTEXT', 'missing_fields': ['seller'], 'message': 'Seller unavailable after retry.'})
missing['evidence'] = [{'schema_version': '1.0.0', 'evidence_id': 'EV-context', 'kind': 'CONTEXT_FAILURE', 'source_id': missing['case_id'], 'text': 'Seller context unavailable.', 'observed_at': missing['updated_at']}]
missing['contributions'] = [{'schema_version': '1.0.0', 'risk_event_id': 'EVENT-context', 'case_id': missing['case_id'], 'signal': 'context', 'contribution': None, 'max': None, 'reason': 'Seller context unavailable.', 'evidence_refs': ['EV-context'], 'source': 'incomplete-data', 'policy_version': '1.0.0', 'timestamp': missing['updated_at']}]
missing['timeline'] = [copy.deepcopy(case['timeline'][0])]
missing['timeline'].append({'schema_version': '1.0.0', 'event_id': 'EVENT-context-failed', 'case_id': missing['case_id'], 'timestamp': missing['updated_at'], 'type': 'CONTEXT_FAILED', 'actor_id': 'SYSTEM', 'message': 'Seller unavailable after retry.'})
validate('data/entities', 'ReturnCase', missing)
bad = copy.deepcopy(missing); bad['risk_score'] = 0
rejects('data/entities', 'ReturnCase', bad)
bad = copy.deepcopy(missing); bad['contributions'][0]['contribution'] = 0
rejects('data/entities', 'ReturnCase', bad)
validate('risk/evaluation', 'MissingContext', {'schema_version': '1.0.0', 'policy_version': '1.0.0', 'code': 'ERROR_MISSING_CONTEXT', 'missing_fields': ['seller']})

manifest_path = ROOT / 'docs/product/baseline-manifest.json'
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text())
    for name, digest in manifest['sha256'].items():
        canonical = (ROOT / name).read_text(encoding='utf-8').replace('\r\n', '\n').encode('utf-8')
        check(hashlib.sha256(canonical).hexdigest() == digest, f'Baseline changed: {name}')
    actual = {p.relative_to(ROOT).as_posix() for p in BASE.rglob('*') if p.is_file()}
    check(actual == set(manifest['sha256']), 'Manifest contract inventory')
print(f'PASS: {checks} checks; {len(schemas)} schema bundles; 9 endpoints; 6 entities; 3 exact seed stories; routing boundaries and negative fixtures.')
print('No AWS, application, persistence, concurrent idempotency or live Bedrock tests run; those belong to later phases.')
