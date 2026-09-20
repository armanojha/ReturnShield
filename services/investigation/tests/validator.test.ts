import { describe, expect, it } from 'vitest';

import { buildEvidenceAllowlist, findUnsupportedRefs } from '../src/ai/allowlist.js';
import { parseModelText, validateInvestigatorOutput } from '../src/ai/validator.js';
import { InvestigationIntegrityError, InvestigatorValidationError } from '../src/errors.js';
import { toInvestigatorInput } from '../src/input.js';
import { assertDeterministicFieldsUnchanged } from '../src/integrity.js';
import { decidedCase, seedExplanationText } from './support/fixtures.js';

function categoryOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof InvestigatorValidationError ? error.category : 'OTHER';
  }
  return undefined;
}

describe('evidence allowlist', () => {
  it('is exactly the evidence attached to the persisted case', () => {
    const value = decidedCase('high');
    expect(buildEvidenceAllowlist(value)).toEqual(value.evidence.map((item) => item.evidence_id));
    expect(toInvestigatorInput(value).allowed_evidence_ids).toEqual(
      value.evidence.map((item) => item.evidence_id),
    );
  });

  it('rejects duplicate evidence IDs and contributions citing unattached evidence', () => {
    const value = decidedCase('high');
    const duplicated = { ...value, evidence: [...value.evidence, value.evidence[0]!] };
    expect(() => buildEvidenceAllowlist(duplicated)).toThrow(InvestigationIntegrityError);
    const detached = { ...value, evidence: value.evidence.slice(1) };
    expect(() => buildEvidenceAllowlist(detached)).toThrow(InvestigationIntegrityError);
  });

  it('reports references outside the allowlist', () => {
    const allowed = new Set(['EV-a', 'EV-b']);
    expect(findUnsupportedRefs(['EV-a', 'EV-x'], allowed)).toEqual(['EV-x']);
    expect(findUnsupportedRefs(['EV-a'], allowed)).toEqual([]);
  });
});

describe('investigator input', () => {
  it('refuses cases that are not decided review cases', () => {
    const value = decidedCase('high');
    expect(() => toInvestigatorInput({ ...value, decision: 'AUTO_APPROVE' })).toThrow(
      InvestigationIntegrityError,
    );
    expect(() => toInvestigatorInput({ ...value, risk_score: null })).toThrow(
      InvestigationIntegrityError,
    );
  });
});

describe('model output validation', () => {
  const input = toInvestigatorInput(decidedCase('high'));

  it.each(['review', 'high'] as const)('accepts the seed explanation for %s', (id) => {
    const source = toInvestigatorInput(decidedCase(id));
    expect(validateInvestigatorOutput(seedExplanationText(id), source).recommended_action).toBe(
      'HUMAN_REVIEW',
    );
  });

  it('classifies parse, size, schema and grounding failures without echoing the output', () => {
    expect(categoryOf(() => parseModelText('not json'))).toBe('MALFORMED_OUTPUT');
    expect(categoryOf(() => parseModelText('x'.repeat(33 * 1024)))).toBe('OUTPUT_TOO_LARGE');
    expect(categoryOf(() => validateInvestigatorOutput('{}', input))).toBe('SCHEMA_INVALID');
    const unsupported = JSON.parse(seedExplanationText('high')) as {
      factors: { evidence_refs: string[] }[];
    };
    unsupported.factors[0]!.evidence_refs = ['EV-high-invented'];
    expect(categoryOf(() => validateInvestigatorOutput(JSON.stringify(unsupported), input))).toBe(
      'UNSUPPORTED_EVIDENCE',
    );
    try {
      parseModelText('secret-model-text');
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-model-text');
    }
  });

  it('allows a stored ratio to be restated as a percentage', () => {
    const output = JSON.parse(seedExplanationText('high')) as { summary: string };
    output.summary = 'Seller return rate of 25% and 3 disputes support human review.';
    expect(validateInvestigatorOutput(JSON.stringify(output), input).summary).toContain('25%');
  });

  it('allows equivalent decimal formatting and case-derived signal counts', () => {
    const output = JSON.parse(seedExplanationText('high')) as { summary: string };
    output.summary = 'All 5 active signals contribute to the 100.0 risk score.';
    expect(validateInvestigatorOutput(JSON.stringify(output), input).summary).toContain(
      '5 active signals',
    );
  });
});

describe('deterministic field guard', () => {
  it('rejects any change to score, decision, priority, contributions or review status', () => {
    const before = decidedCase('high');
    const changes = [
      { risk_score: 10 },
      { raw_contribution_total: 5 },
      { decision: 'AUTO_APPROVE' as const },
      { priority: 'NORMAL' as const },
      { contributions: [] },
      { review_status: 'RESOLVED' as const },
    ];
    for (const change of changes)
      expect(() => assertDeterministicFieldsUnchanged(before, { ...before, ...change })).toThrow(
        InvestigationIntegrityError,
      );
    expect(() =>
      assertDeterministicFieldsUnchanged(before, {
        ...before,
        explanation_status: 'UNAVAILABLE',
        revision: 2,
      }),
    ).not.toThrow();
  });
});
