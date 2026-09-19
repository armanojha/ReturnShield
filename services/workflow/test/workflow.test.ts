import { assertValidEntity } from '@returnshield/contracts';
import type { ReturnContext, ReturnRequestInput } from '@returnshield/context';
import type { Customer, Evidence, Listing, Order, ReturnCase, Seller } from '@returnshield/data';
import { evaluateRisk } from '@returnshield/risk-policy';
import { describe, expect, it } from 'vitest';

import storiesFile from '../../../contracts/seeds/stories.json';
import { buildFinalCase } from '../src/case.js';
import { toRiskInput } from '../src/risk.js';
import type { WorkflowState } from '../src/types.js';

type Story = (typeof storiesFile.stories)[number];
function story(id: string): Story {
  const value = storiesFile.stories.find((item) => item.story_id === id);
  if (!value) throw new Error(id);
  return value;
}
function stateFor(value: Story): WorkflowState {
  const request = value.request as ReturnRequestInput;
  const context: ReturnContext = {
    order: value.order as unknown as Order,
    seller: value.seller as unknown as Seller,
    listing: value.listing as unknown as Listing,
    customer: value.customer as unknown as Customer,
    evidence: value.expected_case.evidence as unknown as Evidence[],
    missing_fields: [],
  };
  const risk_input = toRiskInput(context, request);
  return {
    schema_version: '1.0.0',
    correlation_id: `CORR-${value.story_id}`,
    case_id: `CASE-${value.story_id}`,
    request,
    context,
    risk_input,
    risk: evaluateRisk(risk_input),
  };
}

describe('return workflow result', () => {
  it.each([
    ['clean', 0, 'AUTO_APPROVE', 'NONE'],
    ['review', 45, 'NEEDS_REVIEW', 'NORMAL'],
    ['high', 100, 'NEEDS_REVIEW', 'HIGH'],
  ] as const)('%s seed persists the deterministic result', (id, score, decision, priority) => {
    const built = buildFinalCase(stateFor(story(id)), '2026-09-01T12:00:00Z');
    expect(built.value.risk_score).toBe(score);
    expect(built.value.decision).toBe(decision);
    expect(built.value.priority).toBe(priority);
    expect(built.events).toHaveLength(5);
    expect(built.events.reduce((sum, item) => sum + (item.contribution ?? 0), 0)).toBe(
      built.value.raw_contribution_total,
    );
    expect(assertValidEntity<ReturnCase>('ReturnCase', built.value)).toEqual(built.value);
  });

  it('persists missing context without auto-approval', () => {
    const base = stateFor(story('clean'));
    const context = {
      ...base.context!,
      customer: undefined,
      missing_fields: ['customer'],
    } as unknown as ReturnContext;
    const risk_input = toRiskInput(context, base.request);
    const built = buildFinalCase(
      { ...base, context, risk_input, risk: evaluateRisk(risk_input) },
      '2026-09-01T12:00:00Z',
    );
    expect(built.value.status).toBe('ERROR_MISSING_CONTEXT');
    expect(built.value.decision).toBeNull();
    expect(built.value.contributions[0]?.source).toBe('incomplete-data');
    expect(assertValidEntity<ReturnCase>('ReturnCase', built.value)).toEqual(built.value);
  });

  it('is repeatable for a fixed timestamp', () => {
    const state = stateFor(story('high'));
    expect(buildFinalCase(state, '2026-09-01T12:00:00Z')).toEqual(
      buildFinalCase(state, '2026-09-01T12:00:00Z'),
    );
  });
});
