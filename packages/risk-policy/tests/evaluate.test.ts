import { describe, expect, it } from 'vitest';
import {
  POLICY_VERSION,
  RISK_POLICY,
  RISK_SIGNALS,
  classifyScore,
  clampScore,
  composeEvaluation,
  evaluateRisk,
  toContractResult,
} from '../src/index';
import type {
  RiskContribution,
  RiskDecision,
  RiskEvaluationInput,
  RiskPriority,
  RiskSignal,
} from '../src/index';
import {
  ALL_SIGNALS,
  cleanInput,
  contributionFor,
  deepFreeze,
  expectEvaluation,
  inputWithTriggers,
} from './fixtures';

const MAX: Record<RiskSignal, number> = {
  seller: 30,
  listing: 25,
  customer: 20,
  return: 20,
  category: 15,
};

const BOUNDARY_CASES: [number, RiskDecision, RiskPriority][] = [
  [0, 'AUTO_APPROVE', 'NONE'],
  [29, 'AUTO_APPROVE', 'NONE'],
  [30, 'NEEDS_REVIEW', 'NORMAL'],
  [59, 'NEEDS_REVIEW', 'NORMAL'],
  [60, 'NEEDS_REVIEW', 'HIGH'],
  [100, 'NEEDS_REVIEW', 'HIGH'],
];

function evaluateWith(signals: readonly RiskSignal[]) {
  return expectEvaluation(evaluateRisk(inputWithTriggers(signals)));
}

/**
 * Synthetic composer fixture: distributes `total` across the five signals up to each maximum.
 * Points are arbitrary (not restricted to 0/max) so that scores unreachable by the real
 * signals, such as 29 and 59, can still be pushed through the composer.
 */
function contributionsTotalling(total: number): RiskContribution[] {
  let remaining = total;
  return RISK_SIGNALS.map((signal) => {
    const points = Math.min(remaining, MAX[signal]);
    remaining -= points;
    return {
      schema_version: '1.0.0',
      signal,
      points,
      max: MAX[signal],
      reason: `synthetic ${signal}`,
      evidence_refs: [`EV-synthetic-${signal}`],
    };
  });
}

describe('score bands at the contract boundaries', () => {
  it.each(BOUNDARY_CASES)('classifyScore(%i) -> %s / %s', (score, decision, priority) => {
    const band = classifyScore(score);
    expect(band.decision).toBe(decision);
    expect(band.priority).toBe(priority);
  });

  it.each(BOUNDARY_CASES)('composed total %i -> %s / %s', (total, decision, priority) => {
    const result = composeEvaluation(contributionsTotalling(total));
    expect(result.raw_contribution_total).toBe(total);
    expect(result.score).toBe(total);
    expect(result.decision).toBe(decision);
    expect(result.priority).toBe(priority);
  });

  it('rejects scores outside every band instead of guessing', () => {
    expect(() => classifyScore(-1)).toThrow(RangeError);
    expect(() => classifyScore(101)).toThrow(RangeError);
    expect(() => classifyScore(29.5)).toThrow(RangeError);
  });

  it('reaches 0, 30 and 60 through the real signals', () => {
    const at0 = evaluateWith([]);
    const at30 = evaluateWith(['seller']);
    const at60 = evaluateWith(['listing', 'customer', 'category']);
    const all = [at0, at30, at60];
    expect(all.map((item) => item.score)).toEqual([0, 30, 60]);
    expect(all.map((item) => item.decision)).toEqual([
      'AUTO_APPROVE',
      'NEEDS_REVIEW',
      'NEEDS_REVIEW',
    ]);
    expect(all.map((item) => item.priority)).toEqual(['NONE', 'NORMAL', 'HIGH']);
  });

  it('keeps the highest unclamped reachable score below the clamp', () => {
    const result = evaluateWith(['seller', 'listing', 'customer', 'return']);
    expect(result.raw_contribution_total).toBe(95);
    expect(result.score).toBe(95);
  });
});

describe('explicit clamping', () => {
  it('clamps a raw total of 110 to 100 and keeps both values', () => {
    const result = evaluateWith(ALL_SIGNALS);
    expect(result.raw_contribution_total).toBe(110);
    expect(result.score).toBe(100);
    expect(result.decision).toBe('NEEDS_REVIEW');
    expect(result.priority).toBe('HIGH');
  });

  it('clampScore bounds both ends and passes in-range values through', () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(100)).toBe(100);
    expect(clampScore(101)).toBe(100);
    expect(clampScore(110)).toBe(100);
  });

  it('clampScore rejects non-integer totals', () => {
    expect(() => clampScore(Number.NaN)).toThrow(RangeError);
    expect(() => clampScore(12.5)).toThrow(RangeError);
  });

  it('composer clamps totals above 100', () => {
    const result = composeEvaluation(contributionsTotalling(110));
    expect(result.raw_contribution_total).toBe(110);
    expect(result.score).toBe(100);
  });
});

describe('contribution accounting across all 32 signal combinations', () => {
  const combinations: [string, RiskSignal[]][] = Array.from({ length: 32 }, (_, mask) => {
    const signals = ALL_SIGNALS.filter((_signal, index) => ((mask >> index) & 1) === 1);
    return [signals.join('+') || 'none', signals];
  });

  it.each(combinations)('%s', (_label, signals) => {
    const result = evaluateWith(signals);
    const expectedRaw = signals.reduce((total, signal) => total + MAX[signal], 0);
    const sum = result.contributions.reduce((total, item) => total + item.points, 0);
    const expectedScore = Math.min(expectedRaw, 100);

    expect(sum).toBe(result.raw_contribution_total);
    expect(result.raw_contribution_total).toBe(expectedRaw);
    expect(result.score).toBe(expectedScore);
    expect(result.decision).toBe(expectedScore < 30 ? 'AUTO_APPROVE' : 'NEEDS_REVIEW');
    const expectedPriority = expectedScore < 30 ? 'NONE' : expectedScore < 60 ? 'NORMAL' : 'HIGH';
    expect(result.priority).toBe(expectedPriority);

    for (const signal of RISK_SIGNALS) {
      const item = contributionFor(result, signal);
      expect(item.max).toBe(MAX[signal]);
      expect(item.points).toBe(signals.includes(signal) ? MAX[signal] : 0);
      expect(item.reason.length).toBeGreaterThan(0);
      expect(item.evidence_refs.length).toBeGreaterThan(0);
    }
  });

  it('emits exactly five contributions, one per signal, in fixed order', () => {
    const result = expectEvaluation(evaluateRisk(cleanInput()));
    expect(result.contributions.map((item) => item.signal)).toEqual([
      'seller',
      'listing',
      'customer',
      'return',
      'category',
    ]);
  });
});

describe('evidence references', () => {
  it('every contribution cites at least one unique, contract-shaped id', () => {
    const result = evaluateWith(ALL_SIGNALS);
    for (const item of result.contributions) {
      expect(item.evidence_refs.length).toBeGreaterThan(0);
      expect(new Set(item.evidence_refs).size).toBe(item.evidence_refs.length);
      for (const ref of item.evidence_refs) {
        expect(ref).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/);
      }
    }
  });

  it('top-level evidence_refs is the de-duplicated union of contribution refs', () => {
    const result = expectEvaluation(evaluateRisk(cleanInput()));
    const union = [...new Set(result.contributions.flatMap((item) => item.evidence_refs))];
    expect(result.evidence_refs).toEqual(union);
    expect(result.evidence_refs).toHaveLength(5);
  });

  it('cites every attached record of a kind once and ignores unrelated kinds', () => {
    const base = cleanInput();
    const result = expectEvaluation(
      evaluateRisk({
        ...base,
        evidence: [
          ...(base.evidence ?? []),
          { evidence_id: 'EV-extra-seller', kind: 'SELLER_HISTORY' },
          { evidence_id: 'EV-extra-seller', kind: 'SELLER_HISTORY' },
          { evidence_id: 'EV-context-failure', kind: 'CONTEXT_FAILURE' },
        ],
      }),
    );
    expect(contributionFor(result, 'seller').evidence_refs).toEqual([
      'EV-clean-seller',
      'EV-extra-seller',
    ]);
    expect(result.evidence_refs).not.toContain('EV-context-failure');
    expect(result.evidence_refs).not.toContain('EV-clean-statement');
  });

  it('composer returns copies, so callers cannot mutate a result through its inputs', () => {
    const input = contributionsTotalling(30);
    const result = composeEvaluation(input);
    input[0]?.evidence_refs.push('EV-mutated');
    expect(result.contributions[0]?.evidence_refs).toEqual(['EV-synthetic-seller']);
  });
});

describe('determinism and versioning', () => {
  it('returns identical output for repeated evaluation of the same input', () => {
    const input = inputWithTriggers(['seller', 'category']);
    const first = evaluateRisk(input);
    for (let run = 0; run < 25; run += 1) expect(evaluateRisk(input)).toEqual(first);
    expect(JSON.stringify(evaluateRisk(input))).toBe(JSON.stringify(first));
  });

  it('is unaffected by object key order or evidence order', () => {
    const a = inputWithTriggers(['listing', 'return']);
    const b: RiskEvaluationInput = {
      request: { reason: 'NOT_RECEIVED' },
      evidence: [...(a.evidence ?? [])].reverse(),
      order: { status: 'DELIVERED' },
      customer: { recent_returns: 2 },
      listing: { category: 'HOME', status: 'CORRECTION_REQUIRED' },
      seller: { dispute_count: 2, return_rate: 0.19 },
      history_complete: true,
    };
    expect(expectEvaluation(evaluateRisk(b))).toEqual(expectEvaluation(evaluateRisk(a)));
  });

  it('does not mutate a deeply frozen input and returns fresh objects each call', () => {
    const input = deepFreeze(inputWithTriggers(ALL_SIGNALS));
    const first = expectEvaluation(evaluateRisk(input));
    const second = expectEvaluation(evaluateRisk(input));
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    contributionFor(first, 'seller').points = 999;
    expect(contributionFor(expectEvaluation(evaluateRisk(input)), 'seller').points).toBe(30);
  });

  it('stamps policy_version 1.0.0 and schema_version 1.0.0 on every result', () => {
    expect(POLICY_VERSION).toBe('1.0.0');
    expect(RISK_POLICY.policy_version).toBe('1.0.0');
    const result = expectEvaluation(evaluateRisk(cleanInput()));
    expect(result.policy_version).toBe('1.0.0');
    expect(result.schema_version).toBe('1.0.0');
    for (const item of result.contributions) expect(item.schema_version).toBe('1.0.0');
  });

  it('exposes an immutable policy configuration', () => {
    expect(Object.isFrozen(RISK_POLICY)).toBe(true);
    expect(Object.isFrozen(RISK_POLICY.signals.seller)).toBe(true);
    expect(Object.isFrozen(RISK_POLICY.bands)).toBe(true);
    expect(Object.isFrozen(RISK_POLICY.bands[0])).toBe(true);
  });

  it('contract projection carries exactly the Result fields', () => {
    const projection = toContractResult(expectEvaluation(evaluateRisk(cleanInput())));
    expect(Object.keys(projection).sort()).toEqual([
      'contributions',
      'decision',
      'policy_version',
      'priority',
      'raw_contribution_total',
      'schema_version',
      'score',
    ]);
    for (const item of projection.contributions) {
      expect(Object.keys(item).sort()).toEqual([
        'evidence_refs',
        'max',
        'points',
        'reason',
        'schema_version',
        'signal',
      ]);
    }
  });
});
