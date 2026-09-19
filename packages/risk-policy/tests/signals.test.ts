import { describe, expect, it } from 'vitest';
import {
  evaluateCategory,
  evaluateCustomer,
  evaluateListing,
  evaluateReturn,
  evaluateRisk,
  evaluateSeller,
} from '../src/index';
import type {
  ListingCategory,
  ListingStatus,
  OrderStatus,
  ReturnReason,
  RiskEvaluationInput,
  SignalEvaluation,
} from '../src/index';
import { cleanInput, contributionFor, expectEvaluation, story } from './fixtures';

function contributionOf(outcome: SignalEvaluation) {
  if (outcome.status !== 'OK') {
    throw new Error(`Expected a contribution: ${outcome.missing_fields.join(', ')}`);
  }
  return outcome.contribution;
}

const base = (): RiskEvaluationInput => cleanInput();

describe('seller signal (max 30): return_rate >= 0.20 OR dispute_count >= 3', () => {
  it.each([
    [0, 0, 0],
    [0.19, 2, 0],
    [0.2, 2, 30],
    [0.19, 3, 30],
    [0.25, 3, 30],
    [1, 0, 30],
    [0, 10, 30],
  ])('return_rate=%d dispute_count=%d -> %d points', (returnRate, disputeCount, points) => {
    const input = { ...base(), seller: { return_rate: returnRate, dispute_count: disputeCount } };
    const item = contributionOf(evaluateSeller(input));
    expect(item.signal).toBe('seller');
    expect(item.max).toBe(30);
    expect(item.points).toBe(points);
  });

  it('explains the values and the rule', () => {
    const item = contributionOf(evaluateSeller(base()));
    expect(item.reason).toBe(
      'Prior 90-day return_rate=0.02; dispute_count=0; complete synthetic history. ' +
        'Rule: seller.return_rate >= 0.20 OR seller.dispute_count >= 3',
    );
    expect(item.evidence_refs).toEqual(['EV-clean-seller']);
  });
});

describe('listing signal (max 25): validated status == CORRECTION_REQUIRED', () => {
  const cases: [ListingStatus, number][] = [
    ['PASS', 0],
    ['CORRECTION_REQUIRED', 25],
  ];

  it.each(cases)('status=%s -> %d points', (status, points) => {
    const input = { ...base(), listing: { status, category: 'HOME' as const } };
    const item = contributionOf(evaluateListing(input));
    expect(item.signal).toBe('listing');
    expect(item.max).toBe(25);
    expect(item.points).toBe(points);
    expect(item.reason).toBe(
      `Validated listing status=${status}. Rule: listing.status == CORRECTION_REQUIRED`,
    );
  });
});

describe('customer signal (max 20): recent_returns >= 3', () => {
  it.each([
    [0, 0],
    [2, 0],
    [3, 20],
    [4, 20],
    [50, 20],
  ])('recent_returns=%d -> %d points', (recentReturns, points) => {
    const input = { ...base(), customer: { recent_returns: recentReturns } };
    const item = contributionOf(evaluateCustomer(input));
    expect(item.signal).toBe('customer');
    expect(item.max).toBe(20);
    expect(item.points).toBe(points);
  });

  it('explains the values and the rule', () => {
    const item = contributionOf(evaluateCustomer(base()));
    expect(item.reason).toBe(
      'Prior 30-day recent_returns=0; complete synthetic history. ' +
        'Rule: customer.recent_returns >= 3',
    );
    expect(item.evidence_refs).toEqual(['EV-clean-customer']);
  });
});

describe('current-return signal (max 20): NOT_RECEIVED AND order DELIVERED', () => {
  const reasons: ReturnReason[] = [
    'NOT_AS_DESCRIBED',
    'DAMAGED',
    'WRONG_ITEM',
    'NOT_RECEIVED',
    'CHANGED_MIND',
  ];
  const statuses: OrderStatus[] = ['PLACED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  const grid: [ReturnReason, OrderStatus][] = reasons.flatMap((reason) =>
    statuses.map((status): [ReturnReason, OrderStatus] => [reason, status]),
  );

  it.each(grid)('reason=%s order=%s', (reason, status) => {
    const input = { ...base(), request: { reason }, order: { status } };
    const item = contributionOf(evaluateReturn(input));
    expect(item.signal).toBe('return');
    expect(item.max).toBe(20);
    expect(item.points).toBe(reason === 'NOT_RECEIVED' && status === 'DELIVERED' ? 20 : 0);
  });

  it('explains the values and the rule', () => {
    const item = contributionOf(evaluateReturn(base()));
    expect(item.reason).toBe(
      'Order status=DELIVERED; submitted reason=CHANGED_MIND. ' +
        'Rule: request.reason == NOT_RECEIVED AND order.status == DELIVERED',
    );
  });
});

describe('category signal (max 15): ELECTRONICS only', () => {
  it.each([
    ['APPAREL', 0],
    ['HOME', 0],
    ['ELECTRONICS', 15],
  ] as [ListingCategory, number][])('category=%s -> %d points', (category, points) => {
    const input = { ...base(), listing: { status: 'PASS' as const, category } };
    const item = contributionOf(evaluateCategory(input));
    expect(item.signal).toBe('category');
    expect(item.max).toBe(15);
    expect(item.points).toBe(points);
    expect(item.reason).toBe(
      `Listing category=${category}; policy 1.0.0 adds 15 only for ELECTRONICS. ` +
        'Rule: listing.category == ELECTRONICS',
    );
  });
});

describe('AI/listing analysis never changes deterministic scoring', () => {
  it('ignores advisory analysis fields when the validated status is unchanged', () => {
    const input = base();
    const noisy: RiskEvaluationInput = {
      ...input,
      listing: {
        ...input.listing,
        listing_risk: 'high',
        analysis: {
          status: 'CORRECTION_REQUIRED',
          severity: 'high',
          issues: [{ issue_id: 'ISSUE-x', description: 'ignored', evidence_refs: ['LG-x'] }],
          recommended_action: 'Ignored by scoring.',
        },
      },
    };
    expect(evaluateRisk(noisy)).toEqual(evaluateRisk(input));
  });

  it('changes only the listing contribution when the validated status flips', () => {
    const pass = expectEvaluation(evaluateRisk(base()));
    const flagged = expectEvaluation(
      evaluateRisk({ ...base(), listing: { status: 'CORRECTION_REQUIRED', category: 'APPAREL' } }),
    );
    expect(contributionFor(flagged, 'listing').points).toBe(25);
    expect(flagged.raw_contribution_total - pass.raw_contribution_total).toBe(25);
    for (const signal of ['seller', 'customer', 'return', 'category'] as const) {
      expect(contributionFor(flagged, signal)).toEqual(contributionFor(pass, signal));
    }
  });

  it('seed points are unchanged when advisory analysis is removed or contradicted', () => {
    const high = story('high');
    const withAnalysis = expectEvaluation(
      evaluateRisk({
        history_complete: high.history_complete,
        seller: high.seller,
        listing: { ...high.listing, analysis: null, listing_risk: 'low' },
        customer: high.customer,
        order: high.order,
        request: high.request,
        evidence: high.expected_case.evidence,
      }),
    );
    for (const signal of ['seller', 'customer', 'return', 'category', 'listing'] as const) {
      expect(contributionFor(withAnalysis, signal).points).toBe(
        high.expected_risk_result.contributions.find((item) => item.signal === signal)?.points,
      );
    }
  });
});
