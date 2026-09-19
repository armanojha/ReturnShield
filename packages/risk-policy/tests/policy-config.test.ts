import { describe, expect, it } from 'vitest';
import evaluationSchema from '../../../contracts/risk/evaluation.schema.json';
import policyFile from '../../../contracts/risk/policy.json';
import { RISK_POLICY, RISK_SIGNALS } from '../src/index';

describe('policy configuration matches the frozen contracts', () => {
  it('uses the approved policy version', () => {
    expect(policyFile.approval_status).toBe('APPROVED');
    expect(RISK_POLICY.policy_version).toBe(policyFile.policy_version);
    expect(RISK_POLICY.schema_version).toBe(policyFile.schema_version);
    expect(evaluationSchema.$defs.Result.properties.policy_version.const).toBe(
      RISK_POLICY.policy_version,
    );
  });

  it('matches each signal maximum and rule predicate in policy.json', () => {
    expect(policyFile.signals.map((item) => item.signal)).toEqual([...RISK_SIGNALS]);
    for (const signal of policyFile.signals) {
      const configured = RISK_POLICY.signals[signal.signal as keyof typeof RISK_POLICY.signals];
      expect(configured.max).toBe(signal.max);
      expect(configured.rule).toBe(signal.predicate);
    }
  });

  it('matches the score bands and clamp range', () => {
    expect(RISK_POLICY.bands).toEqual(policyFile.thresholds);
    expect(RISK_POLICY.score_range).toEqual({ min: 0, max: 100 });
    expect(policyFile.aggregation).toBe('sum contributions; clamp to [0,100]');
  });

  it('matches the contract ceiling for the raw contribution total', () => {
    const maxima = Object.values(RISK_POLICY.signals).map((item) => item.max);
    const ceiling = maxima.reduce((total, value) => total + value, 0);
    expect(ceiling).toBe(110);
    expect(evaluationSchema.$defs.Result.properties.raw_contribution_total.maximum).toBe(ceiling);
  });

  it('keeps the bands contiguous and covering the full score range', () => {
    const bands = RISK_POLICY.bands;
    expect(bands[0]?.min).toBe(RISK_POLICY.score_range.min);
    expect(bands[bands.length - 1]?.max).toBe(RISK_POLICY.score_range.max);
    for (let index = 1; index < bands.length; index += 1) {
      expect((bands[index]?.min ?? -1) - (bands[index - 1]?.max ?? -1)).toBe(1);
    }
  });

  it('names the missing-context code defined by the contract', () => {
    const schemaCode = evaluationSchema.$defs.MissingContext.properties.code.const;
    expect(policyFile.missing_context).toBe('ERROR_MISSING_CONTEXT');
    expect(schemaCode).toBe(policyFile.missing_context);
  });
});
