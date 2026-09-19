import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { assertValidAiOutput } from '@returnshield/contracts';
import type { ReturnCase } from '@returnshield/data';

export const REVIEW_EVENT_SOURCE = 'returnshield.returns';
export const REVIEW_EVENT_DETAIL_TYPE = 'RETURN_NEEDS_REVIEW';

/** Mirrors `ai/models.schema.json#/$defs/ReviewEvent`. */
export interface ReviewEventDetail {
  schema_version: '1.0.0';
  event_type: 'RETURN_NEEDS_REVIEW';
  event_id: string;
  case_id: string;
  order_id: string;
  seller_id: string;
  listing_id: string;
  policy_version: '1.0.0';
  risk_score: number;
  priority: 'NORMAL' | 'HIGH';
  occurred_at: string;
}

export interface ReviewEventPublisher {
  publish(detail: ReviewEventDetail): Promise<void>;
}

/**
 * Builds the review event from the committed deterministic case only. The
 * event ID and timestamp derive from the case, so re-emitting after a retry
 * produces an identical event that the consumer deduplicates by `case_id`.
 * Returns undefined for anything that is not a decided review case.
 */
export function buildReviewEvent(value: ReturnCase): ReviewEventDetail | undefined {
  if (
    value.status !== 'DECIDED' ||
    value.decision !== 'NEEDS_REVIEW' ||
    value.risk_score === null ||
    (value.priority !== 'NORMAL' && value.priority !== 'HIGH')
  )
    return undefined;
  return assertValidAiOutput<ReviewEventDetail>('ReviewEvent', {
    schema_version: '1.0.0',
    event_type: REVIEW_EVENT_DETAIL_TYPE,
    event_id: `${value.case_id}-${REVIEW_EVENT_DETAIL_TYPE}`,
    case_id: value.case_id,
    order_id: value.order_id,
    seller_id: value.seller_id,
    listing_id: value.listing_id,
    policy_version: value.policy_version,
    risk_score: value.risk_score,
    priority: value.priority,
    occurred_at: value.created_at,
  });
}

/** A review case that still needs its (first or retried) explanation. */
export function awaitsExplanation(value: ReturnCase): boolean {
  return value.explanation_status === 'PENDING' || value.explanation_status === 'RETRY_PENDING';
}

export class EventBridgeReviewEventPublisher implements ReviewEventPublisher {
  constructor(
    private readonly eventBusName: string,
    private readonly client: EventBridgeClient = new EventBridgeClient({}),
  ) {}

  async publish(detail: ReviewEventDetail): Promise<void> {
    const result = await this.client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: this.eventBusName,
            Source: REVIEW_EVENT_SOURCE,
            DetailType: REVIEW_EVENT_DETAIL_TYPE,
            Detail: JSON.stringify(detail),
          },
        ],
      }),
    );
    if ((result.FailedEntryCount ?? 0) > 0)
      throw new Error('Review event was not accepted by EventBridge');
  }
}
