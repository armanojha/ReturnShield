import storiesFile from '../../../contracts/seeds/stories.json';
import type {
  ContractRiskResult,
  CustomerContext,
  EvidenceRecord,
  ListingContext,
  OrderContext,
  RequestContext,
  RiskEvaluation,
  RiskEvaluationInput,
  RiskEvaluationOutcome,
  RiskSignal,
  SellerContext,
} from '../src/index';
import { isMissingContext } from '../src/index';

export interface StoryFixture {
  story_id: string;
  history_complete: boolean;
  seller: SellerContext;
  listing: ListingContext;
  customer: CustomerContext;
  order: OrderContext;
  request: RequestContext;
  expected_case: { evidence: EvidenceRecord[] };
  expected_risk_result: ContractRiskResult;
}

export const STORIES = storiesFile.stories as unknown as StoryFixture[];

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function story(storyId: 'clean' | 'review' | 'high'): StoryFixture {
  const found = STORIES.find((item) => item.story_id === storyId);
  if (found === undefined) throw new Error(`Seed story ${storyId} not found`);
  return clone(found);
}

/** Case evidence is the evidence attached to the case; contributions may cite only these ids. */
export function inputFromStory(fixture: StoryFixture): RiskEvaluationInput {
  return {
    history_complete: fixture.history_complete,
    seller: fixture.seller,
    listing: fixture.listing,
    customer: fixture.customer,
    order: fixture.order,
    request: fixture.request,
    evidence: fixture.expected_case.evidence,
  };
}

export function cleanInput(): RiskEvaluationInput {
  return inputFromStory(story('clean'));
}

/**
 * Complete input in which exactly the listed signals trigger. Untriggered values sit one step
 * below each threshold (return_rate 0.19, recent_returns 2), so this also exercises boundaries.
 */
export function inputWithTriggers(triggered: readonly RiskSignal[]): RiskEvaluationInput {
  const on = new Set(triggered);
  return {
    ...cleanInput(),
    seller: { return_rate: on.has('seller') ? 0.2 : 0.19, dispute_count: on.has('seller') ? 0 : 2 },
    listing: {
      status: on.has('listing') ? 'CORRECTION_REQUIRED' : 'PASS',
      category: on.has('category') ? 'ELECTRONICS' : 'HOME',
    },
    customer: { recent_returns: on.has('customer') ? 3 : 2 },
    order: { status: 'DELIVERED' },
    request: { reason: on.has('return') ? 'NOT_RECEIVED' : 'CHANGED_MIND' },
  };
}

export const ALL_SIGNALS: readonly RiskSignal[] = [
  'seller',
  'listing',
  'customer',
  'return',
  'category',
];

export function expectEvaluation(outcome: RiskEvaluationOutcome): RiskEvaluation {
  if (isMissingContext(outcome)) {
    const fields = outcome.missing_fields.join(', ');
    throw new Error(`Expected an evaluation, received ${outcome.code}: ${fields}`);
  }
  return outcome;
}

export function expectMissing(outcome: RiskEvaluationOutcome): string[] {
  if (!isMissingContext(outcome)) {
    throw new Error(`Expected ERROR_MISSING_CONTEXT, received score ${outcome.score}`);
  }
  return outcome.missing_fields;
}

export function contributionFor(result: RiskEvaluation, signal: RiskSignal) {
  const found = result.contributions.find((item) => item.signal === signal);
  if (found === undefined) throw new Error(`No contribution for ${signal}`);
  return found;
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
