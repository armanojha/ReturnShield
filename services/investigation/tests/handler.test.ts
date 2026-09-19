import { describe, expect, it } from 'vitest';

import {
  InvestigationEventError,
  InvestigationRetryRequested,
  InvestigatorTransportError,
} from '../src/errors.js';
import { createHandler } from '../src/handler.js';
import {
  ScriptedClient,
  decidedCase,
  dependencies,
  deterministicSnapshot,
  envelopeFor,
  reviewEventFor,
  seedExplanationText,
  seedRepositories,
} from './support/fixtures.js';
import type { Step } from './support/fixtures.js';

async function setup(steps: Step[]) {
  const seeded = decidedCase('high');
  const { repositories } = await seedRepositories(seeded);
  const client = new ScriptedClient(steps);
  return {
    seeded,
    repositories,
    client,
    handle: createHandler(dependencies(repositories, client)),
    envelope: envelopeFor(reviewEventFor(seeded)),
  };
}

describe('Investigator Lambda handler', () => {
  it('explains a case delivered by EventBridge and ignores the redelivery', async () => {
    const ctx = await setup([seedExplanationText('high')]);

    expect((await ctx.handle(ctx.envelope)).outcome).toBe('EXPLAINED');
    expect((await ctx.handle(ctx.envelope)).outcome).toBe('DUPLICATE_IGNORED');

    const after = await ctx.repositories.cases.get('CASE-high');
    expect(after?.explanation_status).toBe('AVAILABLE');
    expect(after?.timeline.filter((entry) => entry.type === 'EXPLANATION_AVAILABLE')).toHaveLength(
      1,
    );
    expect(ctx.client.calls).toHaveLength(1);
  });

  it('fails the invocation on a transient model error so the async retry runs, then settles', async () => {
    const ctx = await setup([
      new InvestigatorTransportError('SERVICE_ERROR', true),
      seedExplanationText('high'),
    ]);

    await expect(ctx.handle(ctx.envelope)).rejects.toBeInstanceOf(InvestigationRetryRequested);
    const pending = await ctx.repositories.cases.get('CASE-high');
    expect(pending?.explanation_status).toBe('RETRY_PENDING');
    expect(deterministicSnapshot(pending!)).toEqual(deterministicSnapshot(ctx.seeded));

    expect((await ctx.handle(ctx.envelope)).outcome).toBe('EXPLAINED');
  });

  it('does not fail the invocation when the retry is exhausted', async () => {
    const ctx = await setup([new InvestigatorTransportError('TIMEOUT', true)]);

    await expect(ctx.handle(ctx.envelope)).rejects.toBeInstanceOf(InvestigationRetryRequested);
    expect((await ctx.handle(ctx.envelope)).outcome).toBe('UNAVAILABLE');

    const after = await ctx.repositories.cases.get('CASE-high');
    expect(after?.explanation_status).toBe('UNAVAILABLE');
    expect(after?.timeline).toEqual(ctx.seeded.timeline);
    expect(deterministicSnapshot(after!)).toEqual(deterministicSnapshot(ctx.seeded));
  });

  it('rejects events of another type and malformed details so they reach the dead-letter queue', async () => {
    const ctx = await setup([seedExplanationText('high')]);

    await expect(ctx.handle({ ...ctx.envelope, 'detail-type': 'SOMETHING_ELSE' })).rejects.toThrow(
      'Unsupported event type',
    );
    await expect(
      ctx.handle({ ...ctx.envelope, detail: { case_id: 'CASE-high' } }),
    ).rejects.toBeInstanceOf(InvestigationEventError);
    expect(ctx.client.calls).toHaveLength(0);
  });
});
