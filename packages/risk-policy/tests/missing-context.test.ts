import { describe, expect, it } from 'vitest';
import {
  evaluateCategory,
  evaluateCustomer,
  evaluateListing,
  evaluateReturn,
  evaluateRisk,
  evaluateSeller,
  isMissingContext,
} from '../src/index';
import type {
  EvidenceKind,
  ListingCategory,
  ListingStatus,
  RiskEvaluationInput,
} from '../src/index';
import { cleanInput, expectMissing } from './fixtures';

function patch(overrides: Partial<RiskEvaluationInput>): RiskEvaluationInput {
  return { ...cleanInput(), ...overrides };
}

function withoutEvidence(kind: EvidenceKind): RiskEvaluationInput {
  const kept = (cleanInput().evidence ?? []).filter((item) => item.kind !== kind);
  return patch({ evidence: kept });
}

const MISSING_CASES: [string, RiskEvaluationInput, string][] = [
  ['seller.return_rate absent', patch({ seller: { dispute_count: 0 } }), 'seller.return_rate'],
  [
    'seller.return_rate null',
    patch({ seller: { return_rate: null, dispute_count: 0 } }),
    'seller.return_rate',
  ],
  ['seller.dispute_count absent', patch({ seller: { return_rate: 0 } }), 'seller.dispute_count'],
  ['seller absent', patch({ seller: null }), 'seller.return_rate'],
  ['listing.status absent', patch({ listing: { category: 'HOME' } }), 'listing.status'],
  ['listing.category absent', patch({ listing: { status: 'PASS' } }), 'listing.category'],
  ['customer.recent_returns absent', patch({ customer: {} }), 'customer.recent_returns'],
  ['request.reason absent', patch({ request: {} }), 'request.reason'],
  ['order.status absent', patch({ order: null }), 'order.status'],
  ['history_complete false', patch({ history_complete: false }), 'history_complete'],
  ['history_complete null', patch({ history_complete: null }), 'history_complete'],
  ['seller evidence absent', withoutEvidence('SELLER_HISTORY'), 'evidence.SELLER_HISTORY'],
  ['listing evidence absent', withoutEvidence('LISTING_CONTENT'), 'evidence.LISTING_CONTENT'],
  ['customer evidence absent', withoutEvidence('CUSTOMER_HISTORY'), 'evidence.CUSTOMER_HISTORY'],
  ['order evidence absent', withoutEvidence('ORDER_RECORD'), 'evidence.ORDER_RECORD'],
  ['category evidence absent', withoutEvidence('CATEGORY_POLICY'), 'evidence.CATEGORY_POLICY'],
];

const INVALID_CASES: [string, RiskEvaluationInput][] = [
  ['seller.return_rate', patch({ seller: { return_rate: 1.5, dispute_count: 0 } })],
  ['seller.return_rate', patch({ seller: { return_rate: -0.1, dispute_count: 0 } })],
  ['seller.return_rate', patch({ seller: { return_rate: Number.NaN, dispute_count: 0 } })],
  ['seller.dispute_count', patch({ seller: { return_rate: 0, dispute_count: 1.5 } })],
  ['seller.dispute_count', patch({ seller: { return_rate: 0, dispute_count: -1 } })],
  ['customer.recent_returns', patch({ customer: { recent_returns: -1 } })],
  ['customer.recent_returns', patch({ customer: { recent_returns: 2.5 } })],
  [
    'listing.status',
    patch({ listing: { status: 'MAYBE' as unknown as ListingStatus, category: 'HOME' } }),
  ],
  [
    'listing.category',
    patch({ listing: { status: 'PASS', category: 'TOYS' as unknown as ListingCategory } }),
  ],
  [
    'evidence.SELLER_HISTORY',
    patch({ evidence: [{ evidence_id: 'bad id!', kind: 'SELLER_HISTORY' }] }),
  ],
];

describe('ERROR_MISSING_CONTEXT', () => {
  it.each(MISSING_CASES)('%s', (_label, input, field) => {
    const outcome = evaluateRisk(input);
    expect(isMissingContext(outcome)).toBe(true);
    expect(expectMissing(outcome)).toContain(field);
  });

  it.each(INVALID_CASES)('out-of-contract value is reported as missing: %s', (field, input) => {
    expect(expectMissing(evaluateRisk(input))).toContain(field);
  });

  it('never silently contributes zero: no score, decision or contributions are produced', () => {
    const outcome = evaluateRisk(patch({ customer: {} }));
    expect(outcome).toEqual({
      schema_version: '1.0.0',
      policy_version: '1.0.0',
      code: 'ERROR_MISSING_CONTEXT',
      missing_fields: ['customer.recent_returns'],
    });
    const scoreKeys = ['score', 'decision', 'priority', 'contributions', 'raw_contribution_total'];
    for (const key of scoreKeys) expect(key in outcome).toBe(false);
  });

  it('never auto-approves when context is missing, even if every present signal is clean', () => {
    const outcome = evaluateRisk(patch({ history_complete: false }));
    expect(isMissingContext(outcome)).toBe(true);
    expect('decision' in outcome).toBe(false);
  });

  it('reports every gap together, in policy order, without duplicates', () => {
    const outcome = evaluateRisk({
      history_complete: false,
      seller: {},
      listing: {},
      customer: {},
      order: {},
      request: {},
      evidence: [],
    });
    expect(expectMissing(outcome)).toEqual([
      'seller.return_rate',
      'seller.dispute_count',
      'history_complete',
      'evidence.SELLER_HISTORY',
      'listing.status',
      'evidence.LISTING_CONTENT',
      'customer.recent_returns',
      'evidence.CUSTOMER_HISTORY',
      'request.reason',
      'order.status',
      'evidence.ORDER_RECORD',
      'listing.category',
      'evidence.CATEGORY_POLICY',
    ]);
  });

  it('treats null, undefined and empty input as fully missing context', () => {
    for (const value of [null, undefined, {}]) {
      const missing = expectMissing(evaluateRisk(value));
      expect(missing).toHaveLength(13);
      expect(new Set(missing).size).toBe(missing.length);
    }
  });

  it('accepts the exact contract boundary values as present context', () => {
    const lower = patch({
      seller: { return_rate: 0, dispute_count: 0 },
      customer: { recent_returns: 0 },
    });
    const upper = patch({ seller: { return_rate: 1, dispute_count: 0 } });
    expect(isMissingContext(evaluateRisk(lower))).toBe(false);
    expect(isMissingContext(evaluateRisk(upper))).toBe(false);
  });

  it('each signal evaluator reports missing context itself instead of returning zero points', () => {
    const evaluators = [
      evaluateSeller,
      evaluateListing,
      evaluateCustomer,
      evaluateReturn,
      evaluateCategory,
    ];
    for (const evaluate of evaluators) {
      const outcome = evaluate({});
      expect(outcome.status).toBe('MISSING_CONTEXT');
      if (outcome.status === 'MISSING_CONTEXT') {
        expect(outcome.missing_fields.length).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic for the same incomplete input', () => {
    const input = patch({ seller: {}, request: {} });
    expect(evaluateRisk(input)).toEqual(evaluateRisk(input));
  });
});
