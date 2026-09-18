import { describe, expect, it } from 'vitest';
import { SEED_DATASET, buildSeedDataset, verifySeedRelationships } from '../src/index.js';

describe('frozen seed projection', () => {
  it('contains exact initial counts and fixed IDs without preloading outcomes', () => {
    expect(SEED_DATASET.sellers.map((v) => v.seller_id)).toEqual([
      'SELLER-clean',
      'SELLER-review',
      'SELLER-high',
    ]);
    expect(SEED_DATASET.listings).toHaveLength(3);
    expect(SEED_DATASET.customers).toHaveLength(3);
    expect(SEED_DATASET.orders).toHaveLength(3);
    expect(SEED_DATASET.expected_initial_counts).toEqual({
      sellers: 3,
      listings: 3,
      customers: 3,
      orders: 3,
      return_cases: 0,
      risk_events: 0,
    });
    expect(verifySeedRelationships(SEED_DATASET)).toEqual([]);
  });
  it('preserves the exact clean/review/high expected outcomes', () => {
    expect(SEED_DATASET.expected_results).toEqual([
      {
        story_id: 'clean',
        case_id: 'CASE-clean',
        raw_contribution_total: 0,
        risk_score: 0,
        decision: 'AUTO_APPROVE',
        priority: 'NONE',
      },
      {
        story_id: 'review',
        case_id: 'CASE-review',
        raw_contribution_total: 45,
        risk_score: 45,
        decision: 'NEEDS_REVIEW',
        priority: 'NORMAL',
      },
      {
        story_id: 'high',
        case_id: 'CASE-high',
        raw_contribution_total: 110,
        risk_score: 100,
        decision: 'NEEDS_REVIEW',
        priority: 'HIGH',
      },
    ]);
  });
  it('is deterministic across repeated projections', () => {
    expect(buildSeedDataset()).toEqual(buildSeedDataset());
  });
});
