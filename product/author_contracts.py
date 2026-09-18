"""Reproduce Phase 00 document schemas/fixtures only; no application implementation."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'contracts'
VERSION = '1.0.0'
URI = 'https://returnshield.example/contracts/'

def write(path, value):
    target = BASE / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, indent=2) + '\n' if not isinstance(value, str) else value, encoding='utf-8', newline='\n')

def obj(properties, optional=()):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties,
            'required': [k for k in properties if k not in optional]}

def enum(*values): return {'enum': list(values)}
def arr(item): return {'type': 'array', 'items': item}
def ref(group, name): return {'$ref': URI + group + '.schema.json#/$defs/' + name}
def nullable(schema): return {'anyOf': [schema, {'type': 'null'}]}
def schema(group, defs):
    result = {'$schema': 'https://json-schema.org/draft/2020-12/schema', '$id': URI + group + '.schema.json', '$defs': defs}
    write(group + '.schema.json', result)
    return result

S = {'type': 'string', 'minLength': 1, 'maxLength': 4000}
ID = {'type': 'string', 'pattern': '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'}
DT = {'type': 'string', 'format': 'date-time', 'pattern': r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$'}
N = {'type': 'integer', 'minimum': 0}
SCORE = {'type': 'integer', 'minimum': 0, 'maximum': 100}
V = {'const': VERSION}
def versioned(props, optional=()): return obj({'schema_version': V, **props}, optional)

# P0-CON-01: product scope is complete before claiming API-owned paths.
api = {}
api['Error'] = versioned({'correlation_id': ID, 'error': obj({
    'code': enum('VALIDATION_ERROR', 'NOT_FOUND', 'IDEMPOTENCY_CONFLICT', 'REQUEST_IN_PROGRESS',
                 'REVISION_CONFLICT', 'INVALID_STATE', 'ERROR_MISSING_CONTEXT', 'AI_UNAVAILABLE',
                 'UNAUTHORIZED', 'FORBIDDEN', 'RATE_LIMITED', 'INTERNAL_ERROR'),
    'message': S, 'retryable': {'type': 'boolean'}, 'details': arr(obj({'field': S, 'message': S}))})})
def envelope(data): return versioned({'correlation_id': ID, 'data': data})
api['HealthResponse'] = envelope(obj({'service': {'const': 'returnshield'}, 'status': {'const': 'ok'}}))
api['ListingRequest'] = versioned({'listing_id': ID, 'seller_id': ID, 'title': S, 'description': S, 'category': enum('APPAREL', 'ELECTRONICS', 'HOME')})
api['ListingResponse'] = envelope(ref('data/entities', 'Listing'))
api['ReturnRequest'] = versioned({'order_id': ID, 'reason': enum('NOT_AS_DESCRIBED', 'DAMAGED', 'WRONG_ITEM', 'NOT_RECEIVED', 'CHANGED_MIND'), 'evidence': arr(ref('data/entities', 'Evidence'))})
api['ReturnResponse'] = envelope(obj({'case': ref('data/entities', 'ReturnCase'), 'replayed': {'type': 'boolean'}}))
api['CaseResponse'] = envelope(ref('data/entities', 'ReturnCase'))
api['SellerResponse'] = envelope(ref('data/entities', 'Seller'))
api['CaseQuery'] = obj({'limit': {'type': 'integer', 'minimum': 1, 'maximum': 100, 'default': 25},
    'cursor': S, 'status': enum('PROCESSING', 'DECIDED', 'ERROR_MISSING_CONTEXT', 'FAILED'),
    'priority': enum('NONE', 'NORMAL', 'HIGH'), 'decision': enum('AUTO_APPROVE', 'NEEDS_REVIEW'),
    'seller_id': ID, 'review_status': enum('OPEN', 'RESOLVED')}, ('limit', 'cursor', 'status', 'priority', 'decision', 'seller_id', 'review_status'))
api['CasesResponse'] = envelope(obj({'items': arr(ref('data/entities', 'ReturnCase')), 'next_cursor': nullable(S)}))
api['DashboardResponse'] = envelope(obj({'as_of': DT, 'flagged_listings': N, 'auto_approved_returns': N,
    'normal_review_cases': N, 'high_review_cases': N, 'open_review_cases': N, 'missing_context_cases': N}))
api['DecisionRequest'] = versioned({'expected_revision': N, 'action': enum('APPROVE_RETURN', 'DECLINE_RETURN'), 'note': S})
api['DecisionResponse'] = envelope(ref('data/entities', 'ReturnCase'))
schema('api/http', api)
routes = [
    ('GET', '/v1/health', None, 'HealthResponse', [200]),
    ('POST', '/v1/listings/analyze', 'ListingRequest', 'ListingResponse', [200, 201]),
    ('GET', '/v1/listings/{listing_id}', None, 'ListingResponse', [200]),
    ('POST', '/v1/returns', 'ReturnRequest', 'ReturnResponse', [200, 202]),
    ('GET', '/v1/cases', None, 'CasesResponse', [200]),
    ('GET', '/v1/cases/{case_id}', None, 'CaseResponse', [200]),
    ('GET', '/v1/sellers/{seller_id}', None, 'SellerResponse', [200]),
    ('GET', '/v1/dashboard/summary', None, 'DashboardResponse', [200]),
    ('POST', '/v1/cases/{case_id}/decision', 'DecisionRequest', 'DecisionResponse', [200]),
]
paths = {}
for method, path, request, response, statuses in routes:
    op = {'operationId': response.replace('Response', '') + method.title(), 'responses': {str(s): {
        'description': 'Successful logical result', 'content': {'application/json': {'schema': ref('api/http', response)}}} for s in statuses}}
    for code in [400, 401, 403, 404, 409, 422, 429, 500, 503]:
        op['responses'][str(code)] = {'description': 'Structured error; see semantics.md', 'content': {'application/json': {'schema': ref('api/http', 'Error')}}}
    params = []
    if '{' in path:
        params.append({'name': path.split('{')[1].split('}')[0], 'in': 'path', 'required': True, 'schema': ID})
    if path == '/v1/cases':
        params.extend({'name': k, 'in': 'query', 'schema': v} for k, v in api['CaseQuery']['properties'].items())
    if method == 'POST':
        if request != 'ReturnRequest': params.append({'name': 'Idempotency-Key', 'in': 'header', 'required': True, 'schema': ID})
        op['requestBody'] = {'required': True, 'content': {'application/json': {'schema': ref('api/http', request)}}}
    if params: op['parameters'] = params
    paths.setdefault(path, {})[method.lower()] = op
write('api/openapi.json', {'openapi': '3.1.0', 'info': {'title': 'ReturnShield Phase 00 API', 'version': VERSION}, 'paths': paths})
write('api/semantics.md', '''# API v1 semantics

All routes and request/response/error schemas are enumerated in openapi.json and http.schema.json (JSON Schema 2020-12). IDs in paths must match the ID schema. JSON bodies reject unknown fields and require schema_version=1.0.0. Malformed JSON, unknown queries, wrong types, empty strings and unsupported versions return 400 VALIDATION_ERROR. Path records absent: 404 NOT_FOUND. Unavailable required related records: 422 ERROR_MISSING_CONTEXT before intake; asynchronous context failure is stored on the case. Authentication failures: 401/403; throttling: 429; unhandled failures: 500; model/service unavailable: 503. Never include stack traces or raw model output in errors. correlation_id is server-generated and consistent across a request; case_id remains stable across its workflow.

## POST idempotency

- Returns use order_id exclusively, without a second client key. First successful durable reservation returns 202 with PROCESSING case. Duplicate while processing returns 202 with the same case_id and replayed=true; terminal duplicate returns 200 with the existing case and replayed=true, without re-scoring. Initial response has replayed=false. Same order with different normalized payload returns 409 IDEMPOTENCY_CONFLICT. Failed/missing-context cases remain the original logical case; POST never creates a replacement.
- Listing analysis requires Idempotency-Key, scoped to POST route. First success returns 201; exact completed replay returns 200 with the original listing/result; in-flight duplicate returns 409 REQUEST_IN_PROGRESS (retryable). Key reused with changed payload returns 409 IDEMPOTENCY_CONFLICT. A listing_id is immutable after successful analysis; a new analysis uses a new listing_id and key. Existing ID under a new key returns 409 INVALID_STATE. AI failures return 503 AI_UNAVAILABLE and persist no trusted listing result. Retry of the same request/key may resume a failed attempt, with at most one committed result.
- Reviewer decision requires Idempotency-Key scoped to case_id and route. First success and identical replay return 200; in-flight duplicate returns retryable 409 REQUEST_IN_PROGRESS. Changed payload under a key returns 409 IDEMPOTENCY_CONFLICT. Check completed replay BEFORE expected_revision. Otherwise atomically compare expected_revision with the case revision; mismatch returns 409 REVISION_CONFLICT. Only DECIDED/NEEDS_REVIEW/OPEN cases allow a disposition; others return 409 INVALID_STATE. One disposition, revision increment and one timeline entry are committed atomically. A second key after resolution fails INVALID_STATE. actor_id comes from the trusted demo/reviewer context, never a request-body assertion.

Normalization means parsed JSON with recursively sorted object keys, preserving array order and exact string contents; compute SHA-256 of its UTF-8 compact serialization including schema_version. Retain reservations and response identity for the lifetime of the associated record (no TTL expiry in MVP). All keys are isolated to the synthetic deployment; multi-tenancy is out of scope. Atomic conditional reservation and stable case_id/execution name prevent concurrent duplicate starts. A crash after reservation is recoverable by retrying the SAME execution identity, never creating a new case/execution. Durable reservation must exist before starting Step Functions. Workflow writes and review events deduplicate by case_id plus policy_version/event type; explanation and timeline persistence must be conditional.

## Reads and reviewer semantics

GET /cases defaults to all cases, limit=25; optional filters are ANDed exact matches. Sort by created_at descending then case_id ascending. Opaque cursor binds filters and last sort tuple; invalid/mismatched cursor returns 400. No offset paging. A page is not a cross-request snapshot. Return at most limit records and null next_cursor at exhaustion. Missing-context records remain visible via status filter despite null priority/decision. Case detail is the canonical evidence, contribution, timeline and explanation read model. Each referenced seller/listing/customer/order relationship must agree with the order.

Dashboard counts cover the entire synthetic dataset, not a queue page: flagged listings=CORRECTION_REQUIRED; auto-approved returns=DECIDED/AUTO_APPROVE; normal/high counts=DECIDED/NEEDS_REVIEW with matching priority, including resolved cases; open_review_cases=DECIDED/NEEDS_REVIEW/OPEN; missing_context_cases=ERROR_MISSING_CONTEXT. as_of is the read timestamp, counts may be eventually consistent.

Reviewer actions do not overwrite policy decision, score, priority or contributions. Persist disposition separately, set review_status=RESOLVED and append REVIEWER_DECISION. No refund/payment side effect exists in the MVP. Error and retry state never masquerade as listing PASS or return AUTO_APPROVE.
''')

# P0-DATA-01: independent of API; product dependency is DONE.
d = {}
d['Evidence'] = versioned({'evidence_id': ID, 'kind': enum('SELLER_HISTORY', 'LISTING_CONTENT', 'CUSTOMER_HISTORY', 'ORDER_RECORD', 'RETURN_STATEMENT', 'CATEGORY_POLICY', 'CONTEXT_FAILURE'),
    'source_id': ID, 'text': S, 'observed_at': DT})
d['Seller'] = versioned({'seller_id': ID, 'trust_score': SCORE, 'listing_flags': N, 'return_rate': {'type': 'number', 'minimum': 0, 'maximum': 1}, 'dispute_count': N, 'cases': arr(ID)})
d['Listing'] = versioned({'listing_id': ID, 'seller_id': ID, 'title': S, 'description': S, 'category': enum('APPAREL', 'ELECTRONICS', 'HOME'),
    'listing_risk': enum('low', 'medium', 'high'), 'status': enum('PASS', 'CORRECTION_REQUIRED'), 'analysis': ref('ai/models', 'ListingGuardOutput'),
    'analysis_metadata': obj({'model_id': S, 'prompt_version': V, 'schema_version': V, 'validation_result': {'const': 'VALID'}, 'correlation_id': ID}), 'created_at': DT})
d['Customer'] = versioned({'customer_id': ID, 'return_count': N, 'recent_returns': N, 'account_age_days': N, 'case_history': arr(ID)})
d['Order'] = versioned({'order_id': ID, 'seller_id': ID, 'customer_id': ID, 'listing_id': ID, 'timestamp': DT,
    'status': enum('PLACED', 'SHIPPED', 'DELIVERED', 'CANCELLED'), 'delivered_at': nullable(DT)})
d['TimelineEntry'] = versioned({'event_id': ID, 'case_id': ID, 'timestamp': DT, 'type': enum('RETURN_RECEIVED', 'POLICY_DECIDED', 'CONTEXT_FAILED', 'WORKFLOW_FAILED', 'REVIEW_REQUESTED', 'EXPLANATION_AVAILABLE', 'EXPLANATION_UNAVAILABLE', 'REVIEWER_DECISION'), 'actor_id': ID, 'message': S})
d['ReviewerDisposition'] = versioned({'action': enum('APPROVE_RETURN', 'DECLINE_RETURN'), 'actor_id': ID, 'note': S, 'decided_at': DT})
d['RiskEvent'] = versioned({'risk_event_id': ID, 'case_id': ID, 'signal': enum('seller', 'listing', 'customer', 'return', 'category', 'context'),
    'contribution': nullable({'type': 'integer', 'minimum': 0, 'maximum': 30}), 'max': nullable({'type': 'integer', 'minimum': 0, 'maximum': 30}),
    'reason': S, 'evidence_refs': {'type': 'array', 'items': ID, 'minItems': 1, 'uniqueItems': True},
    'source': enum('seller-history', 'listing-analysis', 'customer-history', 'order-return', 'category-policy', 'incomplete-data'), 'policy_version': V, 'timestamp': DT})
d['RiskEvent']['allOf'] = [{'if': {'properties': {'source': {'const': 'incomplete-data'}}}, 'then': {'properties': {'signal': {'const': 'context'}, 'contribution': {'type': 'null'}, 'max': {'type': 'null'}}}, 'else': {'properties': {'signal': enum('seller', 'listing', 'customer', 'return', 'category'), 'contribution': {'type': 'integer'}, 'max': {'type': 'integer'}}}}]
d['ReturnCase'] = versioned({'case_id': ID, 'order_id': ID, 'seller_id': ID, 'listing_id': ID, 'customer_id': ID,
    'reason': api['ReturnRequest']['properties']['reason'], 'evidence': arr(ref('data/entities', 'Evidence')),
    'status': enum('PROCESSING', 'DECIDED', 'ERROR_MISSING_CONTEXT', 'FAILED'), 'revision': N,
    'raw_contribution_total': nullable({'type': 'integer', 'minimum': 0, 'maximum': 110}), 'risk_score': nullable(SCORE), 'policy_version': V,
    'decision': nullable(enum('AUTO_APPROVE', 'NEEDS_REVIEW')), 'priority': nullable(enum('NONE', 'NORMAL', 'HIGH')),
    'contributions': arr(ref('data/entities', 'RiskEvent')), 'review_status': enum('NOT_APPLICABLE', 'OPEN', 'RESOLVED'),
    'reviewer_disposition': nullable(ref('data/entities', 'ReviewerDisposition')), 'explanation_status': enum('NOT_REQUESTED', 'PENDING', 'AVAILABLE', 'UNAVAILABLE', 'RETRY_PENDING'),
    'explanation': nullable(ref('ai/models', 'InvestigatorOutput')), 'error': nullable(obj({'code': enum('ERROR_MISSING_CONTEXT', 'WORKFLOW_FAILED'), 'missing_fields': arr(S), 'message': S})),
    'timeline': arr(ref('data/entities', 'TimelineEntry')), 'created_at': DT, 'updated_at': DT})
d['ReturnCase']['allOf'] = [
    {'if': {'properties': {'status': {'const': 'DECIDED'}}}, 'then': {'properties': {'raw_contribution_total': {'type': 'integer'}, 'risk_score': {'type': 'integer'}, 'decision': {'type': 'string'}, 'priority': {'type': 'string'}, 'error': {'type': 'null'}, 'contributions': {'minItems': 5, 'maxItems': 5}}},
     'else': {'properties': {'raw_contribution_total': {'type': 'null'}, 'risk_score': {'type': 'null'}, 'decision': {'type': 'null'}, 'priority': {'type': 'null'}, 'review_status': {'const': 'NOT_APPLICABLE'}, 'reviewer_disposition': {'type': 'null'}, 'explanation_status': {'const': 'NOT_REQUESTED'}, 'explanation': {'type': 'null'}}}},
    {'if': {'properties': {'status': {'const': 'ERROR_MISSING_CONTEXT'}}}, 'then': {'properties': {'error': {'type': 'object', 'properties': {'code': {'const': 'ERROR_MISSING_CONTEXT'}, 'missing_fields': {'minItems': 1}}}, 'contributions': {'minItems': 1, 'items': {'properties': {'source': {'const': 'incomplete-data'}}}}}}},
    {'if': {'properties': {'explanation_status': {'const': 'AVAILABLE'}}}, 'then': {'properties': {'explanation': {'type': 'object'}}}, 'else': {'properties': {'explanation': {'type': 'null'}}}},
    {'if': {'properties': {'review_status': {'const': 'RESOLVED'}}}, 'then': {'properties': {'reviewer_disposition': {'type': 'object'}}}, 'else': {'properties': {'reviewer_disposition': {'type': 'null'}}}},
    {'if': {'properties': {'decision': {'const': 'AUTO_APPROVE'}}}, 'then': {'properties': {'risk_score': {'maximum': 29}, 'priority': {'const': 'NONE'}, 'review_status': {'const': 'NOT_APPLICABLE'}, 'explanation_status': {'const': 'NOT_REQUESTED'}}}},
    {'if': {'properties': {'decision': {'const': 'NEEDS_REVIEW'}}}, 'then': {'properties': {'risk_score': {'minimum': 30}, 'review_status': enum('OPEN', 'RESOLVED')}, 'allOf': [{'if': {'properties': {'risk_score': {'maximum': 59}}}, 'then': {'properties': {'priority': {'const': 'NORMAL'}}}, 'else': {'properties': {'priority': {'const': 'HIGH'}}}}]}},
]
for signal, maximum, source in [('seller', 30, 'seller-history'), ('listing', 25, 'listing-analysis'), ('customer', 20, 'customer-history'), ('return', 20, 'order-return'), ('category', 15, 'category-policy')]:
    d['RiskEvent']['allOf'].append({'if': {'properties': {'signal': {'const': signal}}}, 'then': {'properties': {'max': {'const': maximum}, 'contribution': enum(0, maximum), 'source': {'const': source}}}})
    d['ReturnCase']['allOf'].append({'if': {'properties': {'status': {'const': 'DECIDED'}}}, 'then': {'properties': {'contributions': {'contains': {'properties': {'signal': {'const': signal}}}, 'minContains': 1, 'maxContains': 1}}}})
for state in ['PROCESSING', 'FAILED']:
    d['ReturnCase']['allOf'].append({'if': {'properties': {'status': {'const': state}}}, 'then': {'properties': {'contributions': {'maxItems': 0}, 'error': {'type': 'null'} if state == 'PROCESSING' else {'type': 'object', 'properties': {'code': {'const': 'WORKFLOW_FAILED'}}}}}})
schema('data/entities', d)
write('data/relationships.md', '''# Entity semantics and integrity

entities.schema.json is authoritative for all six entities plus evidence, timeline and reviewer disposition. All timestamps are UTC RFC3339. Entity IDs are stable, synthetic and unique per entity type. No DynamoDB layout is mandated before Phase 02.

Seller 1:N Listing and Order; Customer 1:N Order; Order N:1 Listing and at most one ReturnCase; ReturnCase 1:N RiskEvent. Order.seller_id must equal Listing.seller_id. Case seller/listing/customer/order IDs must agree. Seller.cases and Customer.case_history reference earlier cases and exclude the current evaluation; they may be empty, but a missing history result is not an empty result. Evidence IDs are unique within a case; every contribution/factor reference must belong to that case. RiskEvents have stable case_id/signal/policy_version identity. A decided case contains exactly one event per five signals; raw total equals their contribution sum. Risk package score maps exactly to ReturnCase.risk_score, never a second stored score.

Seller return_rate is a ratio (returned orders / delivered orders, 0 when verified denominator is zero), computed over the 90 days strictly before return intake; dispute_count and listing_flags use that window. trust_score is supplied synthetic marketplace context, not recomputed or used as a sixth signal. Customer return_count is lifetime prior returns; recent_returns counts prior returns during the preceding 30 days, excluding this intake, and must not exceed return_count. account_age_days is complete elapsed days at intake. Each history fetch must certify completeness and freeze its observation time. Subsequent history changes never rescore an existing case. A delivered order requires delivered_at >= timestamp; other statuses require delivered_at=null.

Listing.listing_risk equals analysis.severity; Listing.status equals analysis.status. Failed analysis produces no trusted Listing. metadata records the actual model ID, schema/prompt version, successful validation and correlation; seed fixtures explicitly use synthetic-fixture. Evidence text is supplied evidence, not automatically factual; return statements retain their origin. Validate exact listing quotes and case evidence allowlists outside JSON Schema.

State transitions: intake -> PROCESSING -> DECIDED, ERROR_MISSING_CONTEXT or FAILED. No score exists until complete deterministic evaluation. Missing context stores explicit missing fields and one nonnumeric incomplete-data RiskEvent; retry external fetch once before terminal missing-context status. PROCESSING has no error/contributions; FAILED has WORKFLOW_FAILED and no contributions. Terminal failed cases require operational recovery, not new POST creation. No automatic review decision or explanation runs on missing context. DECIDED policy fields are immutable; explanation updates and the single reviewer action increase revision and updated_at independently without erasing the result. NEEDS_REVIEW starts OPEN; reviewer action resolves it. AUTO_APPROVE is NOT_APPLICABLE. Persist the corresponding timeline event exactly once per logical transition. Async reads may see PENDING explanation but must see the complete atomic policy result.
''')

# P0-RISK-01: proposed predicates fill gaps in the source, weights remain authoritative.
rules = [
    {'signal': 'seller', 'max': 30, 'predicate': 'seller.return_rate >= 0.20 OR seller.dispute_count >= 3', 'source': 'seller-history', 'required_fields': ['seller.return_rate', 'seller.dispute_count']},
    {'signal': 'listing', 'max': 25, 'predicate': 'listing.status == CORRECTION_REQUIRED', 'source': 'listing-analysis', 'required_fields': ['listing.status']},
    {'signal': 'customer', 'max': 20, 'predicate': 'customer.recent_returns >= 3', 'source': 'customer-history', 'required_fields': ['customer.recent_returns']},
    {'signal': 'return', 'max': 20, 'predicate': 'request.reason == NOT_RECEIVED AND order.status == DELIVERED', 'source': 'order-return', 'required_fields': ['request.reason', 'order.status']},
    {'signal': 'category', 'max': 15, 'predicate': 'listing.category == ELECTRONICS', 'source': 'category-policy', 'required_fields': ['listing.category']},
]
write('risk/policy.json', {'schema_version': VERSION, 'policy_version': VERSION, 'approval_status': 'PENDING', 'signals': rules,
    'aggregation': 'sum contributions; clamp to [0,100]', 'thresholds': [{'min': 0, 'max': 29, 'decision': 'AUTO_APPROVE', 'priority': 'NONE'}, {'min': 30, 'max': 59, 'decision': 'NEEDS_REVIEW', 'priority': 'NORMAL'}, {'min': 60, 'max': 100, 'decision': 'NEEDS_REVIEW', 'priority': 'HIGH'}], 'missing_context': 'ERROR_MISSING_CONTEXT'})
schema('risk/evaluation', {'Contribution': versioned({'signal': enum(*(r['signal'] for r in rules)), 'points': {'type': 'integer', 'minimum': 0, 'maximum': 30}, 'max': {'type': 'integer', 'minimum': 0, 'maximum': 30}, 'reason': S, 'evidence_refs': {'type': 'array', 'items': ID, 'minItems': 1, 'uniqueItems': True}}),
    'Result': versioned({'policy_version': V, 'raw_contribution_total': {'type': 'integer', 'minimum': 0, 'maximum': 110}, 'score': SCORE, 'decision': enum('AUTO_APPROVE', 'NEEDS_REVIEW'), 'priority': enum('NONE', 'NORMAL', 'HIGH'), 'contributions': {'type': 'array', 'items': ref('risk/evaluation', 'Contribution'), 'minItems': 5, 'maxItems': 5}}),
    'MissingContext': versioned({'policy_version': V, 'code': {'const': 'ERROR_MISSING_CONTEXT'}, 'missing_fields': {'type': 'array', 'items': S, 'minItems': 1}})})
write('risk/policy.md', '''# Deterministic policy 1.0.0 — approval candidate

policy.json freezes five binary predicates: each true predicate contributes its full max, false contributes zero. Weights and routing are sourced; numeric trigger cutoffs and ELECTRONICS category selection are proposed demo policy choices, not calibrated fraud indicators. No partial weights, AI scoring, mutable clock, network call or random input is permitted in the future pure evaluator.

Required context: valid seller, listing with validated analysis, customer, order, return request, complete prior seller/customer history and supporting case evidence for every signal. Required fields are enumerated per rule; null, missing, invalid, failed retrieval or unverifiable evidence is ERROR_MISSING_CONTEXT. Check completeness before calculating any contribution. Verified zero is valid; absence is not zero. Upstream fetch retries once on transient failure; the pure evaluator does not retry. It returns MissingContext, never Result, for incomplete input. No partial score is persisted. The case workflow records the error separately with null scores and an incomplete-data diagnostic event.

Evaluate in seller/listing/customer/return/category order. Each contribution includes actual observed values, the predicate, points/max and at least one attached evidence ID. Sum all five into raw_contribution_total (0–110); score=min(100,max(0,raw)). Map score to 0–29 AUTO_APPROVE/NONE, 30–59 NEEDS_REVIEW/NORMAL, 60–100 NEEDS_REVIEW/HIGH. No auto-rejection. Persist all five events including verified zeroes. The event contribution field equals the package points field; risk_score equals score. Incomplete-data events carry null, never zero points, and cannot enter a scored result.

Reviewer disposition and AI explanation never mutate policy outputs. Predicate rules, enum expansion, window definitions, thresholds and weights require an ADR after approval. Boundary fixtures include 29/59 even though not every total is reachable by the binary predicates; these exercise the decision function in isolation. These documents and their verifier are not the Phase 04 production evaluator.
''')

# P0-AI-01: API schemas/semantics authored before AI task starts.
lg = versioned({'status': enum('PASS', 'CORRECTION_REQUIRED'), 'severity': enum('low', 'medium', 'high'),
    'issues': arr(obj({'issue_id': ID, 'description': S, 'evidence_refs': {'type': 'array', 'items': ID, 'minItems': 1, 'uniqueItems': True}})),
    'evidence': arr(obj({'evidence_id': ID, 'field': enum('title', 'description', 'category'), 'quote': S})), 'recommended_action': S})
lg['allOf'] = [{'if': {'properties': {'status': {'const': 'PASS'}}}, 'then': {'properties': {'severity': {'const': 'low'}, 'issues': {'maxItems': 0}}}, 'else': {'properties': {'severity': enum('medium', 'high'), 'issues': {'minItems': 1}, 'evidence': {'minItems': 1}}}}]
schema('ai/models', {
    'ListingGuardInput': versioned({'title': S, 'description': S, 'category': enum('APPAREL', 'ELECTRONICS', 'HOME')}),
    'ListingGuardOutput': lg,
    'InvestigatorInput': versioned({'case_id': ID, 'policy_result': ref('risk/evaluation', 'Result'), 'evidence': arr(ref('data/entities', 'Evidence')), 'allowed_evidence_ids': {'type': 'array', 'items': ID, 'uniqueItems': True}}),
    'InvestigatorOutput': versioned({'summary': S, 'factors': {'type': 'array', 'minItems': 1, 'items': obj({'signal': enum(*(r['signal'] for r in rules)), 'explanation': S, 'evidence_refs': {'type': 'array', 'items': ID, 'minItems': 1, 'uniqueItems': True}})}, 'recommended_action': {'const': 'HUMAN_REVIEW'}}),
    'ReviewEvent': versioned({'event_type': {'const': 'RETURN_NEEDS_REVIEW'}, 'event_id': ID, 'case_id': ID, 'order_id': ID, 'seller_id': ID, 'listing_id': ID, 'policy_version': V, 'risk_score': {'type': 'integer', 'minimum': 30, 'maximum': 100}, 'priority': enum('NORMAL', 'HIGH'), 'occurred_at': DT})})
write('ai/validation-and-failure.md', '''# AI boundary and failure contract

Prompt version 1.0.0 for both roles. Treat all listing/return/evidence text as untrusted data, including embedded instructions. Supply only typed input; no tools, external browsing or database access. Require a single JSON object without Markdown; reject extra keys, malformed JSON, invalid types/enums, missing schema_version and output beyond 32 KiB. Apply a 20-second call timeout and at most one retry for throttling/transient transport failure. Schema/grounding failures are not trusted results and do not receive a silent PASS fallback.

ListingGuard prompt intent: identify contradictions/quality issues using only title, description and category; return supplied-content quotations, explicit issues, severity and correction guidance. Validate quote is an exact substring of its named input field, evidence IDs are unique and issue references belong to returned evidence. Require each correction issue to have supporting evidence. PASS requires low severity and zero issues. Map validated severity/status exactly to the Listing. On failure return 503 AI_UNAVAILABLE; retain operational failure metadata without persisting a trusted analysis. Log model/prompt/schema version, correlation, validation outcome and safe error category; do not log raw untrusted output as a trusted result.

Investigator prompt intent: explain the already-decided case using attached evidence only, distinguishing source statements from verified observations; use elevated-risk/needs-review language. Every factor must reference allowed evidence and match an actual policy signal. Summary claims must be supported by those factors; prohibit new identities, events, amounts or accusations. The allowlist must exactly equal input evidence IDs, and every contribution's evidence refs must be in it. Read persisted case after DECIDED/NEEDS_REVIEW only. Output fields for scores, decision, priority, contributions or policy version are forbidden. Store explanation separately after schema and grounding validation. A lexical allowlist alone cannot prove semantic grounding; Phase 06 must test unsupported claims as well as unknown IDs.

For review cases explanation starts PENDING. Success becomes AVAILABLE; retriable transport error becomes RETRY_PENDING while a bounded retry remains; exhaustion, malformed output or unsupported evidence becomes UNAVAILABLE with null explanation. Preserve case usability and ALL deterministic fields on every outcome. AUTO_APPROVE and missing-context cases stay NOT_REQUESTED. Repeated events use case_id/policy_version to deduplicate explanation/timeline writes. Review event is emitted only after the deterministic case is committed and uses a stable event_id; priority must agree with risk_score. Delivery failure is recoverable without rescore. Direct invocation fallback uses the same input/output contracts and requires an ADR if adopted.
''')

# P0-SEED-01: entity and risk definitions now complete.
T = '2026-09-01T12:00:00Z'
stories = []
for label, flags in [('clean', [False]*5), ('review', [True, False, False, False, True]), ('high', [True]*5)]:
    sid, lid, cid, oid, caseid = [prefix + '-' + label for prefix in ['SELLER', 'LISTING', 'CUSTOMER', 'ORDER', 'CASE']]
    seller = {'schema_version': VERSION, 'seller_id': sid, 'trust_score': 50 if flags[0] else 95, 'listing_flags': int(flags[1]), 'return_rate': .25 if flags[0] else .02, 'dispute_count': 3 if flags[0] else 0, 'cases': []}
    analysis = {'schema_version': VERSION, 'status': 'CORRECTION_REQUIRED' if flags[1] else 'PASS', 'severity': 'high' if flags[1] else 'low', 'issues': [], 'evidence': [], 'recommended_action': 'Correct contradictory condition claims.' if flags[1] else 'No correction required.'}
    title = 'Brand new sealed headphones' if flags[1] else ('Wireless headphones' if flags[4] else 'Cotton shirt')
    description = 'Used headphones with scratches.' if flags[1] else 'Unopened item matching the title.'
    if flags[1]:
        analysis['evidence'] = [{'evidence_id': 'LG-title', 'field': 'title', 'quote': title}, {'evidence_id': 'LG-description', 'field': 'description', 'quote': description}]
        analysis['issues'] = [{'issue_id': 'ISSUE-condition', 'description': 'New and used condition claims conflict.', 'evidence_refs': ['LG-title', 'LG-description']}]
    listing = {'schema_version': VERSION, 'listing_id': lid, 'seller_id': sid, 'title': title, 'description': description, 'category': 'ELECTRONICS' if flags[4] else 'APPAREL', 'listing_risk': analysis['severity'], 'status': analysis['status'], 'analysis': analysis, 'analysis_metadata': {'model_id': 'synthetic-fixture', 'prompt_version': VERSION, 'schema_version': VERSION, 'validation_result': 'VALID', 'correlation_id': 'CORR-' + label}, 'created_at': '2026-08-01T00:00:00Z'}
    customer = {'schema_version': VERSION, 'customer_id': cid, 'return_count': 4 if flags[2] else 0, 'recent_returns': 3 if flags[2] else 0, 'account_age_days': 365, 'case_history': []}
    order = {'schema_version': VERSION, 'order_id': oid, 'seller_id': sid, 'customer_id': cid, 'listing_id': lid, 'timestamp': '2026-08-20T00:00:00Z', 'status': 'DELIVERED', 'delivered_at': '2026-08-25T00:00:00Z'}
    reason = 'NOT_RECEIVED' if flags[3] else 'CHANGED_MIND'
    kinds = ['SELLER_HISTORY', 'LISTING_CONTENT', 'CUSTOMER_HISTORY', 'ORDER_RECORD', 'CATEGORY_POLICY']
    texts = [f'Prior 90-day return_rate={seller["return_rate"]}; dispute_count={seller["dispute_count"]}; complete synthetic history.', f'Validated listing status={listing["status"]}.', f'Prior 30-day recent_returns={customer["recent_returns"]}; complete synthetic history.', f'Order status=DELIVERED; submitted reason={reason}.', f'Listing category={listing["category"]}; policy 1.0.0 adds 15 only for ELECTRONICS.']
    evidence = [{'schema_version': VERSION, 'evidence_id': 'EV-' + label + '-' + r['signal'], 'kind': kinds[i], 'source_id': [sid, lid, cid, oid, lid][i], 'text': texts[i], 'observed_at': T} for i, r in enumerate(rules)]
    request = {'schema_version': VERSION, 'order_id': oid, 'reason': reason, 'evidence': [{'schema_version': VERSION, 'evidence_id': 'EV-' + label + '-statement', 'kind': 'RETURN_STATEMENT', 'source_id': oid, 'text': 'Synthetic return reason: ' + reason, 'observed_at': T}]}
    events = [{'schema_version': VERSION, 'risk_event_id': caseid + '-' + r['signal'], 'case_id': caseid, 'signal': r['signal'], 'contribution': r['max'] if flags[i] else 0, 'max': r['max'], 'reason': texts[i] + ' Rule: ' + r['predicate'], 'evidence_refs': [evidence[i]['evidence_id']], 'source': r['source'], 'policy_version': VERSION, 'timestamp': T} for i, r in enumerate(rules)]
    raw = sum(e['contribution'] for e in events)
    score = min(raw, 100)
    decision, priority = ('AUTO_APPROVE', 'NONE') if score < 30 else ('NEEDS_REVIEW', 'NORMAL' if score < 60 else 'HIGH')
    explanation = None if score < 30 else {'schema_version': VERSION, 'summary': 'Supplied synthetic evidence supports human review.', 'factors': [{'signal': e['signal'], 'explanation': e['reason'], 'evidence_refs': e['evidence_refs']} for e in events if e['contribution']], 'recommended_action': 'HUMAN_REVIEW'}
    timeline_types = ['RETURN_RECEIVED', 'POLICY_DECIDED'] + (['REVIEW_REQUESTED', 'EXPLANATION_AVAILABLE'] if score >= 30 else [])
    case = {'schema_version': VERSION, 'case_id': caseid, 'order_id': oid, 'seller_id': sid, 'listing_id': lid, 'customer_id': cid, 'reason': reason, 'evidence': evidence + request['evidence'], 'status': 'DECIDED', 'revision': len(timeline_types), 'raw_contribution_total': raw, 'risk_score': score, 'policy_version': VERSION, 'decision': decision, 'priority': priority, 'contributions': events, 'review_status': 'OPEN' if score >= 30 else 'NOT_APPLICABLE', 'reviewer_disposition': None, 'explanation_status': 'AVAILABLE' if explanation else 'NOT_REQUESTED', 'explanation': explanation, 'error': None, 'timeline': [{'schema_version': VERSION, 'event_id': caseid + '-' + k, 'case_id': caseid, 'timestamp': T, 'type': k, 'actor_id': 'SYSTEM', 'message': k} for k in timeline_types], 'created_at': T, 'updated_at': T}
    result = {'schema_version': VERSION, 'policy_version': VERSION, 'raw_contribution_total': raw, 'score': score, 'decision': decision, 'priority': priority, 'contributions': [{'schema_version': VERSION, 'signal': e['signal'], 'points': e['contribution'], 'max': e['max'], 'reason': e['reason'], 'evidence_refs': e['evidence_refs']} for e in events]}
    stories.append({'schema_version': VERSION, 'story_id': label, 'evaluation_at': T, 'history_complete': True, 'seller': seller, 'listing': listing, 'customer': customer, 'order': order, 'request': request, 'expected_risk_result': result, 'expected_case': case, 'expected_review_event': score >= 30})
write('seeds/stories.json', {'schema_version': VERSION, 'stories': stories})
write('seeds/truth.md', '''# Synthetic seed truth

stories.json fixes inputs, exact IDs, timestamp, five evidence-backed events, expected policy results and complete expected cases. Baseline inventory before workflow: 3 sellers, 3 listings, 3 customers, 3 orders, zero cases/events. After running the three returns: 3 cases, 15 RiskEvents; two review events and two validated explanations when enabled. Expected cases are verification fixtures, not records to preload before demonstrating workflow creation. Aggregate prior-history metrics describe synthetic external marketplace history; no dangling prior case IDs are introduced. Seed loader/reset is Phase 02, not implemented here.

| Story | seller | listing | customer | return | category | raw | score | decision/priority |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| clean | 0 | 0 | 0 | 0 | 0 | 0 | 0 | AUTO_APPROVE/NONE |
| review | 30 | 0 | 0 | 0 | 15 | 45 | 45 | NEEDS_REVIEW/NORMAL |
| high | 30 | 25 | 20 | 20 | 15 | 110 | 100 | NEEDS_REVIEW/HIGH |

High listing contains exact contradictory new/used quotations and must be CORRECTION_REQUIRED/high. Other listings are PASS/low. Listing analysis fixtures are validated expected examples, not a guarantee of verbatim live model output. Deterministic cases use the persisted validated listing status; real model integration must separately pass Phase 03. Live explanations may vary in wording but must satisfy schema/grounding, preserve every policy field and reference only the fixed case evidence. Fixture explanation text demonstrates the expected shape, not a claimed Bedrock run.

Expected dashboard after all stories: flagged_listings=1, auto_approved_returns=1, normal_review_cases=1, high_review_cases=1, open_review_cases=2, missing_context_cases=0. Queue at equal timestamps sorts CASE-clean, CASE-high, CASE-review by ID. Replaying each return retains its original case, 15 total events and two explanations. Removing required context yields ERROR_MISSING_CONTEXT with null score and no policy decision; malformed AI output leaves the review decision unchanged and explanation UNAVAILABLE. Approval of these explicit predicates and truth is required before implementation.
''')

# Strengthen package output rules without implementing the production evaluator.
risk_path = BASE / 'risk/evaluation.schema.json'
risk_schema = json.loads(risk_path.read_text())
risk_schema['$defs']['Contribution']['allOf'] = [
    {'if': {'properties': {'signal': {'const': r['signal']}}}, 'then': {'properties': {'max': {'const': r['max']}, 'points': enum(0, r['max'])}}} for r in rules]
risk_schema['$defs']['Result']['allOf'] = [
    {'if': {'properties': {'score': {'minimum': low, 'maximum': high}}}, 'then': {'properties': {'decision': {'const': decision}, 'priority': {'const': priority}}}}
    for low, high, decision, priority in [(0, 29, 'AUTO_APPROVE', 'NONE'), (30, 59, 'NEEDS_REVIEW', 'NORMAL'), (60, 100, 'NEEDS_REVIEW', 'HIGH')]]
risk_schema['$defs']['Result']['allOf'] += [{'properties': {'contributions': {'contains': {'properties': {'signal': {'const': r['signal']}}}, 'minContains': 1, 'maxContains': 1}}} for r in rules]
write('risk/evaluation.schema.json', risk_schema)
print('Authored API, data, risk, AI and seed contracts in dependency order.')
