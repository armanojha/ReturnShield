import type { Repositories, ReturnCase } from '@returnshield/data';
import { describe, expect, it } from 'vitest';

import { buildInvestigatorPrompt } from '../src/ai/prompt.js';
import {
  InvestigationCaseMissingError,
  InvestigationEventError,
  InvestigatorTransportError,
} from '../src/errors.js';
import { investigateReviewEvent } from '../src/investigate.js';
import type { InvestigatorOutput } from '../src/types.js';
import {
  ScriptedClient,
  decidedCase,
  dependencies,
  deterministicSnapshot,
  reviewEventFor,
  seedExplanationText,
  seedRepositories,
} from './support/fixtures.js';
import type { Step } from './support/fixtures.js';

async function setup(
  id: 'review' | 'high',
  steps: Step[],
  mutate?: (base: ReturnCase) => ReturnCase,
) {
  const seeded = mutate ? mutate(decidedCase(id)) : decidedCase(id);
  const { repositories } = await seedRepositories(seeded);
  const client = new ScriptedClient(steps);
  return {
    seeded,
    repositories,
    client,
    deps: dependencies(repositories, client),
    event: reviewEventFor(seeded),
  };
}

async function load(repositories: Pick<Repositories, 'cases'>, caseId: string) {
  const value = await repositories.cases.get(caseId);
  if (!value) throw new Error(`Case ${caseId} was not persisted`);
  return value;
}

/** A failed or unsupported explanation must leave the deterministic case fully usable. */
async function expectCaseIntact(
  ctx: Awaited<ReturnType<typeof setup>>,
  status: 'UNAVAILABLE' | 'RETRY_PENDING',
) {
  const after = await load(ctx.repositories, ctx.seeded.case_id);
  expect(after.explanation_status).toBe(status);
  expect(after.explanation).toBeNull();
  expect(after.timeline).toEqual(ctx.seeded.timeline);
  expect(deterministicSnapshot(after)).toEqual(deterministicSnapshot(ctx.seeded));
  expect(after.revision).toBe(ctx.seeded.revision + 1);
  return after;
}

function tampered(id: 'review' | 'high', change: (output: InvestigatorOutput) => void): string {
  const output = JSON.parse(seedExplanationText(id)) as InvestigatorOutput;
  change(output);
  return JSON.stringify(output);
}

describe('grounded explanation for a high-risk case', () => {
  it('persists the validated explanation with supported evidence and one timeline entry', async () => {
    const ctx = await setup('high', [seedExplanationText('high')]);

    const result = await investigateReviewEvent(ctx.event, ctx.deps);

    expect(result).toEqual({ outcome: 'EXPLAINED', case_id: 'CASE-high' });
    const after = await load(ctx.repositories, 'CASE-high');
    expect(after.explanation_status).toBe('AVAILABLE');
    expect(after.explanation).toEqual(JSON.parse(seedExplanationText('high')));
    const allowed = new Set(after.evidence.map((item) => item.evidence_id));
    const factors = (after.explanation as unknown as InvestigatorOutput).factors;
    expect(factors).toHaveLength(5);
    for (const factor of factors)
      for (const ref of factor.evidence_refs) expect(allowed.has(ref)).toBe(true);
    expect(after.timeline.filter((entry) => entry.type === 'EXPLANATION_AVAILABLE')).toHaveLength(
      1,
    );
    expect(after.revision).toBe(2);
    expect(after.risk_score).toBe(100);
    expect(after.raw_contribution_total).toBe(110);
    expect(deterministicSnapshot(after)).toEqual(deterministicSnapshot(ctx.seeded));
  });

  it('explains a normal-priority review case too', async () => {
    const ctx = await setup('review', [seedExplanationText('review')]);
    expect((await investigateReviewEvent(ctx.event, ctx.deps)).outcome).toBe('EXPLAINED');
    const after = await load(ctx.repositories, 'CASE-review');
    expect(after.explanation_status).toBe('AVAILABLE');
    expect(after.priority).toBe('NORMAL');
  });

  it('sends the model only the persisted case evidence and permitted metadata', async () => {
    const ctx = await setup('high', [seedExplanationText('high')]);
    await investigateReviewEvent(ctx.event, ctx.deps);

    const input = ctx.client.calls[0];
    expect(input).toBeDefined();
    expect(Object.keys(input ?? {}).sort()).toEqual([
      'allowed_evidence_ids',
      'case_id',
      'evidence',
      'policy_result',
      'schema_version',
    ]);
    expect(input?.evidence).toEqual(ctx.seeded.evidence);
    expect(input?.allowed_evidence_ids).toEqual(
      ctx.seeded.evidence.map((item) => item.evidence_id),
    );
    const prompt = buildInvestigatorPrompt(input!);
    expect(prompt.user).toContain('EV-high-seller');
    expect(prompt.user).not.toContain('reviewer_disposition');
    expect(prompt.system).toContain('untrusted');
    expect(prompt.system).toContain('HUMAN_REVIEW');
  });
});

type Change = (output: InvestigatorOutput) => void;

describe('unsupported evidence and claims', () => {
  it.each<[string, Change]>([
    [
      'an evidence ID that does not exist',
      (output: InvestigatorOutput) => {
        output.factors[0]!.evidence_refs = ['EV-high-invented'];
      },
    ],
    [
      'evidence that belongs to a different case',
      (output: InvestigatorOutput) => {
        output.factors[0]!.evidence_refs = ['EV-review-seller'];
      },
    ],
    [
      'attached evidence that is not behind the factor signal',
      (output: InvestigatorOutput) => {
        output.factors[0]!.evidence_refs = ['EV-high-category'];
      },
    ],
  ])('marks the explanation UNAVAILABLE for %s', async (_label, change) => {
    const ctx = await setup('high', [tampered('high', change)]);

    const result = await investigateReviewEvent(ctx.event, ctx.deps);

    expect(result.outcome).toBe('UNAVAILABLE');
    await expectCaseIntact(ctx, 'UNAVAILABLE');
  });

  it.each<[string, Change]>([
    [
      'an invented amount',
      (output: InvestigatorOutput) => {
        output.summary = 'The return is linked to a 500 refund exposure.';
      },
    ],
    [
      'an accusation',
      (output: InvestigatorOutput) => {
        output.factors[1]!.explanation = 'The seller is running a fraud scheme.';
      },
    ],
    [
      'an identity that is not in the case',
      (output: InvestigatorOutput) => {
        output.summary = 'Linked to SELLER-9999 in earlier cases.';
      },
    ],
    [
      'a duplicated signal',
      (output: InvestigatorOutput) => {
        output.factors.push({ ...output.factors[0]! });
      },
    ],
  ])('rejects %s even when every evidence ID is allowed', async (_label, change) => {
    const ctx = await setup('high', [tampered('high', change)]);

    expect((await investigateReviewEvent(ctx.event, ctx.deps)).outcome).toBe('UNAVAILABLE');
    await expectCaseIntact(ctx, 'UNAVAILABLE');
  });

  it('rejects a factor for a signal that contributed zero points', async () => {
    const ctx = await setup('review', [
      tampered('review', (output) => {
        output.factors.push({
          signal: 'listing',
          explanation: 'Validated listing status=PASS.',
          evidence_refs: ['EV-review-listing'],
        });
      }),
    ]);

    expect((await investigateReviewEvent(ctx.event, ctx.deps)).outcome).toBe('UNAVAILABLE');
    await expectCaseIntact(ctx, 'UNAVAILABLE');
  });

  it('marks UNAVAILABLE without calling the model when an allowlist cannot be built', async () => {
    const ctx = await setup('high', [seedExplanationText('high')], (base) => ({
      ...base,
      evidence: base.evidence.filter((item) => item.evidence_id !== 'EV-high-seller'),
    }));

    expect((await investigateReviewEvent(ctx.event, ctx.deps)).outcome).toBe('UNAVAILABLE');
    expect(ctx.client.calls).toHaveLength(0);
    await expectCaseIntact(ctx, 'UNAVAILABLE');
  });
});

describe('malformed model output', () => {
  const valid = seedExplanationText('high');
  const withField = (key: string, value: unknown) =>
    JSON.stringify({ ...(JSON.parse(valid) as object), [key]: value });

  it.each<[string, string]>([
    ['prose instead of JSON', 'I think this case looks risky.'],
    ['an empty response', ''],
    ['truncated JSON', valid.slice(0, valid.length - 12)],
    ['JSON wrapped in prose', `Here is the result: ${valid}`],
    ['an array', '[]'],
    ['an attempt to overwrite the score', withField('risk_score', 0)],
    ['an attempt to overwrite the decision', withField('decision', 'AUTO_APPROVE')],
    ['an attempt to change priority', withField('priority', 'NONE')],
    ['an attempt to change contributions', withField('contributions', [])],
    ['a wrong recommended action', withField('recommended_action', 'AUTO_APPROVE')],
    ['a missing schema version', JSON.stringify({ summary: 'x', factors: [] })],
    ['output beyond 32 KiB', withField('summary', 'x'.repeat(33 * 1024))],
  ])('never persists %s', async (_label, text) => {
    const ctx = await setup('high', [text]);

    expect((await investigateReviewEvent(ctx.event, ctx.deps)).outcome).toBe('UNAVAILABLE');
    await expectCaseIntact(ctx, 'UNAVAILABLE');
  });

  it('accepts a single Markdown code fence around otherwise valid JSON', async () => {
    const ctx = await setup('high', ['```json\n' + valid + '\n```']);
    expect((await investigateReviewEvent(ctx.event, ctx.deps)).outcome).toBe('EXPLAINED');
  });
});

describe('timeout and Bedrock failure', () => {
  it('leaves the case RETRY_PENDING after a first transient failure, then UNAVAILABLE when the retry also fails', async () => {
    const ctx = await setup('high', [new InvestigatorTransportError('TIMEOUT', true)]);

    const first = await investigateReviewEvent(ctx.event, ctx.deps);
    expect(first.outcome).toBe('RETRY_PENDING');
    const pending = await load(ctx.repositories, 'CASE-high');
    expect(pending.explanation_status).toBe('RETRY_PENDING');
    expect(pending.explanation).toBeNull();
    expect(deterministicSnapshot(pending)).toEqual(deterministicSnapshot(ctx.seeded));

    const second = await investigateReviewEvent(ctx.event, ctx.deps);
    expect(second.outcome).toBe('UNAVAILABLE');
    expect(ctx.client.calls).toHaveLength(2);
    const after = await load(ctx.repositories, 'CASE-high');
    expect(after.explanation_status).toBe('UNAVAILABLE');
    expect(after.explanation).toBeNull();
    expect(after.timeline).toEqual(ctx.seeded.timeline);
    expect(deterministicSnapshot(after)).toEqual(deterministicSnapshot(ctx.seeded));
  });

  it('completes the explanation when the retry succeeds', async () => {
    const ctx = await setup('high', [
      new InvestigatorTransportError('THROTTLED', true),
      seedExplanationText('high'),
    ]);

    expect((await investigateReviewEvent(ctx.event, ctx.deps)).outcome).toBe('RETRY_PENDING');
    expect((await investigateReviewEvent(ctx.event, ctx.deps)).outcome).toBe('EXPLAINED');
    const after = await load(ctx.repositories, 'CASE-high');
    expect(after.explanation_status).toBe('AVAILABLE');
    expect(after.timeline.filter((entry) => entry.type === 'EXPLANATION_AVAILABLE')).toHaveLength(
      1,
    );
    expect(deterministicSnapshot(after)).toEqual(deterministicSnapshot(ctx.seeded));
  });

  it.each<[string, Error]>([
    ['a non-retriable Bedrock rejection', new InvestigatorTransportError('REJECTED', false)],
    ['an unexpected client error', new Error('socket hang up')],
  ])('marks UNAVAILABLE immediately after %s', async (_label, failure) => {
    const ctx = await setup('high', [failure]);

    expect((await investigateReviewEvent(ctx.event, ctx.deps)).outcome).toBe('UNAVAILABLE');
    expect(ctx.client.calls).toHaveLength(1);
    await expectCaseIntact(ctx, 'UNAVAILABLE');
  });

  it('does not call the model again once the explanation is UNAVAILABLE', async () => {
    const ctx = await setup('high', [new InvestigatorTransportError('REJECTED', false)]);
    await investigateReviewEvent(ctx.event, ctx.deps);

    expect((await investigateReviewEvent(ctx.event, ctx.deps)).outcome).toBe('DUPLICATE_IGNORED');
    expect(ctx.client.calls).toHaveLength(1);
  });
});

describe('duplicate events and idempotency', () => {
  it('creates no second explanation or timeline entry for a repeated event', async () => {
    const ctx = await setup('high', [seedExplanationText('high')]);

    const first = await investigateReviewEvent(ctx.event, ctx.deps);
    const afterFirst = await load(ctx.repositories, 'CASE-high');
    const second = await investigateReviewEvent(ctx.event, ctx.deps);
    const afterSecond = await load(ctx.repositories, 'CASE-high');

    expect(first.outcome).toBe('EXPLAINED');
    expect(second.outcome).toBe('DUPLICATE_IGNORED');
    expect(ctx.client.calls).toHaveLength(1);
    expect(afterSecond).toEqual(afterFirst);
    expect(afterSecond.revision).toBe(2);
    expect(
      afterSecond.timeline.filter((entry) => entry.type === 'EXPLANATION_AVAILABLE'),
    ).toHaveLength(1);
  });

  it('writes exactly one explanation when the same event is delivered concurrently', async () => {
    const ctx = await setup('high', [seedExplanationText('high')]);

    const results = await Promise.all([
      investigateReviewEvent(ctx.event, ctx.deps),
      investigateReviewEvent(ctx.event, ctx.deps),
      investigateReviewEvent(ctx.event, ctx.deps),
    ]);

    expect(results.filter((item) => item.outcome === 'EXPLAINED')).toHaveLength(1);
    expect(results.filter((item) => item.outcome === 'DUPLICATE_IGNORED')).toHaveLength(2);
    const after = await load(ctx.repositories, 'CASE-high');
    expect(after.revision).toBe(2);
    expect(after.explanation_status).toBe('AVAILABLE');
    expect(after.timeline.filter((entry) => entry.type === 'EXPLANATION_AVAILABLE')).toHaveLength(
      1,
    );
    expect(deterministicSnapshot(after)).toEqual(deterministicSnapshot(ctx.seeded));
  });
});

describe('events that must not reach the model', () => {
  it('rejects an event that violates the frozen ReviewEvent contract', async () => {
    const ctx = await setup('high', [seedExplanationText('high')]);

    await expect(
      investigateReviewEvent({ ...ctx.event, risk_score: 12, extra: true }, ctx.deps),
    ).rejects.toBeInstanceOf(InvestigationEventError);
    expect(ctx.client.calls).toHaveLength(0);
    expect(await load(ctx.repositories, 'CASE-high')).toEqual(ctx.seeded);
  });

  it('ignores an event whose facts disagree with the persisted case', async () => {
    const ctx = await setup('high', [seedExplanationText('high')]);

    const result = await investigateReviewEvent({ ...ctx.event, risk_score: 45 }, ctx.deps);

    expect(result.outcome).toBe('NOT_ELIGIBLE');
    expect(ctx.client.calls).toHaveLength(0);
    expect(await load(ctx.repositories, 'CASE-high')).toEqual(ctx.seeded);
  });

  it('fails visibly when the case named by the event does not exist', async () => {
    const ctx = await setup('high', [seedExplanationText('high')]);

    await expect(
      investigateReviewEvent({ ...ctx.event, case_id: 'CASE-missing' }, ctx.deps),
    ).rejects.toBeInstanceOf(InvestigationCaseMissingError);
    expect(ctx.client.calls).toHaveLength(0);
  });
});
