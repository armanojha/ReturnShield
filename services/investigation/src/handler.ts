import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createRepositories, DynamoDbRepositoryStore } from '@returnshield/data';

import { BedrockInvestigatorClient } from './ai/client.js';
import { InvestigationRetryRequested } from './errors.js';
import { investigateReviewEvent } from './investigate.js';
import type { InvestigationDependencies } from './investigate.js';
import type { InvestigationResult } from './types.js';

/** The subset of an EventBridge event envelope this consumer reads. */
export interface ReviewEventEnvelope {
  'detail-type'?: string;
  source?: string;
  detail?: unknown;
}

export const REVIEW_EVENT_DETAIL_TYPE = 'RETURN_NEEDS_REVIEW';
export const REVIEW_EVENT_SOURCE = 'returnshield.returns';

export function createHandler(deps: InvestigationDependencies) {
  return async function handle(envelope: ReviewEventEnvelope): Promise<InvestigationResult> {
    if (
      envelope['detail-type'] !== REVIEW_EVENT_DETAIL_TYPE ||
      envelope.source !== REVIEW_EVENT_SOURCE
    )
      throw new Error('Unsupported event type for the Investigator');
    const result = await investigateReviewEvent(envelope.detail, deps);
    // A transient model failure leaves the case RETRY_PENDING; failing the
    // invocation triggers the single asynchronous retry, then the DLQ.
    if (result.outcome === 'RETRY_PENDING') throw new InvestigationRetryRequested(result.case_id);
    return result;
  };
}

function buildDependencies(): InvestigationDependencies {
  const tableName = process.env.RETURNSHIELD_TABLE_NAME ?? '';
  if (!tableName) throw new Error('Investigation service is not configured');
  const store = new DynamoDbRepositoryStore(
    tableName,
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
  );
  return { repositories: createRepositories(store), client: new BedrockInvestigatorClient() };
}

let cached: ReturnType<typeof createHandler> | undefined;

export async function handler(envelope: ReviewEventEnvelope): Promise<InvestigationResult> {
  cached ??= createHandler(buildDependencies());
  return cached(envelope);
}

export default handler;
