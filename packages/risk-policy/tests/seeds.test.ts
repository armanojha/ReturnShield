import { describe, expect, it } from 'vitest';
import { evaluateRisk, toContractResult } from '../src/index';
import { contributionFor, expectEvaluation, inputFromStory, story } from './fixtures';

const SEEDS = [
  { id: 'clean', raw: 0, score: 0, decision: 'AUTO_APPROVE', priority: 'NONE' },
  { id: 'review', raw: 45, score: 45, decision: 'NEEDS_REVIEW', priority: 'NORMAL' },
  { id: 'high', raw: 110, score: 100, decision: 'NEEDS_REVIEW', priority: 'HIGH' },
] as const;

describe('frozen seed truth', () => {
  it.each(SEEDS)('$id seed matches the stated outcome', (seed) => {
    const result = expectEvaluation(evaluateRisk(inputFromStory(story(seed.id))));
    expect(result.raw_contribution_total).toBe(seed.raw);
    expect(result.score).toBe(seed.score);
    expect(result.decision).toBe(seed.decision);
    expect(result.priority).toBe(seed.priority);
    expect(result.policy_version).toBe('1.0.0');
  });

  it.each(SEEDS)('$id seed equals contracts/seeds/stories.json expected_risk_result', (seed) => {
    const fixture = story(seed.id);
    const result = expectEvaluation(evaluateRisk(inputFromStory(fixture)));
    // Deep equality covers points, max, reason text and evidence refs of every contribution.
    expect(toContractResult(result)).toEqual(fixture.expected_risk_result);
  });

  it('clean seed contributes zero for every signal', () => {
    const result = expectEvaluation(evaluateRisk(inputFromStory(story('clean'))));
    expect(result.contributions.map((item) => item.points)).toEqual([0, 0, 0, 0, 0]);
  });

  it('review seed is explained by the seller and category signals only', () => {
    const result = expectEvaluation(evaluateRisk(inputFromStory(story('review'))));
    expect(result.contributions.map((item) => [item.signal, item.points])).toEqual([
      ['seller', 30],
      ['listing', 0],
      ['customer', 0],
      ['return', 0],
      ['category', 15],
    ]);
  });

  it('high seed triggers all five signals and needs the explicit clamp', () => {
    const result = expectEvaluation(evaluateRisk(inputFromStory(story('high'))));
    expect(result.contributions.map((item) => item.points)).toEqual([30, 25, 20, 20, 15]);
    expect(result.raw_contribution_total).toBe(110);
    expect(result.score).toBe(100);
  });

  it.each(SEEDS)('$id seed cites only evidence attached to the case', (seed) => {
    const fixture = story(seed.id);
    const attached = new Set(fixture.expected_case.evidence.map((item) => item.evidence_id));
    const result = expectEvaluation(evaluateRisk(inputFromStory(fixture)));
    expect(result.evidence_refs).toEqual([
      `EV-${seed.id}-seller`,
      `EV-${seed.id}-listing`,
      `EV-${seed.id}-customer`,
      `EV-${seed.id}-return`,
      `EV-${seed.id}-category`,
    ]);
    for (const ref of result.evidence_refs) expect(attached.has(ref)).toBe(true);
    // The free-text return statement is context only; no signal cites it.
    expect(result.evidence_refs).not.toContain(`EV-${seed.id}-statement`);
    expect(contributionFor(result, 'return').evidence_refs).toEqual([`EV-${seed.id}-return`]);
  });
});
