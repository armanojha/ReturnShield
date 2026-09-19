import { createRepositories } from '@returnshield/data';
import type { ReturnCase } from '@returnshield/data';

import storiesFile from '../../../../contracts/seeds/stories.json';
import type { InvestigatorModelClient, InvestigatorModelResponse } from '../../src/ai/client.js';
import type { InvestigationDependencies } from '../../src/investigate.js';
import type { InvestigatorInput, ReviewEventDetail } from '../../src/types.js';
import { InMemoryRepositoryStore } from './in-memory-store.js';

export const NOW = '2026-09-01T12:05:00Z';

type StoryId = 'clean' | 'review' | 'high';

function story(id: StoryId) {
  const found = storiesFile.stories.find((item) => item.story_id === id);
  if (!found) throw new Error(`Missing seed story ${id}`);
  return found;
}

/** The decided case exactly as the Phase 05 workflow persists it: explanation PENDING. */
export function decidedCase(id: 'review' | 'high'): ReturnCase {
  const expected = structuredClone(story(id).expected_case) as unknown as ReturnCase;
  return {
    ...expected,
    revision: 1,
    explanation_status: 'PENDING',
    explanation: null,
    timeline: expected.timeline.filter((entry) => entry.type !== 'EXPLANATION_AVAILABLE'),
  };
}

/** A deterministic case that needs no explanation. */
export function autoApprovedCase(): ReturnCase {
  return {
    ...(structuredClone(story('clean').expected_case) as unknown as ReturnCase),
    revision: 1,
  };
}

/** The grounded explanation the seed contract expects for a review case. */
export function seedExplanationText(id: 'review' | 'high'): string {
  return JSON.stringify(story(id).expected_case.explanation);
}

export function reviewEventFor(value: ReturnCase): ReviewEventDetail {
  return {
    schema_version: '1.0.0',
    event_type: 'RETURN_NEEDS_REVIEW',
    event_id: `${value.case_id}-RETURN_NEEDS_REVIEW`,
    case_id: value.case_id,
    order_id: value.order_id,
    seller_id: value.seller_id,
    listing_id: value.listing_id,
    policy_version: '1.0.0',
    risk_score: value.risk_score as number,
    priority: value.priority as 'NORMAL' | 'HIGH',
    occurred_at: value.created_at,
  };
}

export function envelopeFor(detail: unknown) {
  return { 'detail-type': 'RETURN_NEEDS_REVIEW', source: 'returnshield.returns', detail };
}

export async function seedRepositories(value: ReturnCase) {
  const store = new InMemoryRepositoryStore();
  const repositories = createRepositories(store);
  await repositories.cases.createDecision(value, value.contributions);
  return { store, repositories };
}

export type Step = string | Error;

/** Replays scripted model responses in order; the last step repeats once exhausted. */
export class ScriptedClient implements InvestigatorModelClient {
  readonly modelId = 'test-model';
  readonly calls: InvestigatorInput[] = [];
  constructor(private readonly steps: Step[]) {}
  async investigate(input: InvestigatorInput): Promise<InvestigatorModelResponse> {
    this.calls.push(input);
    const step = this.steps[Math.min(this.calls.length, this.steps.length) - 1];
    if (step === undefined) throw new Error('ScriptedClient has no steps');
    if (step instanceof Error) throw step;
    return { model_id: this.modelId, text: step };
  }
}

export function dependencies(
  repositories: InvestigationDependencies['repositories'],
  client: InvestigatorModelClient,
): InvestigationDependencies {
  return { repositories, client, now: () => NOW, log: () => undefined };
}

/** Every field the Investigator must never change, for before/after comparison. */
export function deterministicSnapshot(value: ReturnCase) {
  return {
    status: value.status,
    raw_contribution_total: value.raw_contribution_total,
    risk_score: value.risk_score,
    policy_version: value.policy_version,
    decision: value.decision,
    priority: value.priority,
    contributions: value.contributions,
    review_status: value.review_status,
    reviewer_disposition: value.reviewer_disposition,
    evidence: value.evidence,
    error: value.error,
  };
}
