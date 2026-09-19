import type { Evidence, ReturnCase, RiskEvent } from '@returnshield/data';
import { isMissingContext } from '@returnshield/risk-policy';

import type { WorkflowState } from './types.js';

const SOURCE: Record<string, RiskEvent['source']> = {
  seller: 'seller-history',
  listing: 'listing-analysis',
  customer: 'customer-history',
  return: 'order-return',
  category: 'category-policy',
};

function timeline(
  caseId: string,
  type: 'RETURN_RECEIVED' | 'POLICY_DECIDED' | 'CONTEXT_FAILED',
  timestamp: string,
) {
  return {
    schema_version: '1.0.0' as const,
    event_id: `${caseId}-${type}`,
    case_id: caseId,
    timestamp,
    type,
    actor_id: 'SYSTEM',
    message: type,
  };
}

export function buildFinalCase(
  state: WorkflowState,
  timestamp = new Date().toISOString(),
): { value: ReturnCase; events: RiskEvent[] } {
  if (!state.context || !state.risk || !state.context.order)
    throw new Error('Workflow state is incomplete');
  const { order } = state.context;
  if (isMissingContext(state.risk)) {
    const contextEvidence: Evidence = {
      schema_version: '1.0.0',
      evidence_id: `${state.case_id}-missing-context`,
      kind: 'CONTEXT_FAILURE',
      source_id: state.case_id,
      text: `Missing required context: ${state.risk.missing_fields.join(', ')}`,
      observed_at: timestamp,
    };
    const event: RiskEvent = {
      schema_version: '1.0.0',
      risk_event_id: `${state.case_id}-context`,
      case_id: state.case_id,
      signal: 'context',
      contribution: null,
      max: null,
      reason: contextEvidence.text,
      evidence_refs: [contextEvidence.evidence_id],
      source: 'incomplete-data',
      policy_version: '1.0.0',
      timestamp,
    };
    return {
      value: {
        schema_version: '1.0.0',
        case_id: state.case_id,
        order_id: order.order_id,
        seller_id: order.seller_id,
        listing_id: order.listing_id,
        customer_id: order.customer_id,
        reason: state.request.reason,
        evidence: [...state.context.evidence, contextEvidence],
        status: 'ERROR_MISSING_CONTEXT',
        revision: 1,
        raw_contribution_total: null,
        risk_score: null,
        policy_version: '1.0.0',
        decision: null,
        priority: null,
        contributions: [event],
        review_status: 'NOT_APPLICABLE',
        reviewer_disposition: null,
        explanation_status: 'NOT_REQUESTED',
        explanation: null,
        error: {
          code: 'ERROR_MISSING_CONTEXT',
          missing_fields: state.risk.missing_fields,
          message: 'Required return context was unavailable.',
        },
        timeline: [
          timeline(state.case_id, 'RETURN_RECEIVED', timestamp),
          timeline(state.case_id, 'CONTEXT_FAILED', timestamp),
        ],
        created_at: timestamp,
        updated_at: timestamp,
      },
      events: [event],
    };
  }
  const events: RiskEvent[] = state.risk.contributions.map((item) => ({
    schema_version: '1.0.0',
    risk_event_id: `${state.case_id}-${item.signal}`,
    case_id: state.case_id,
    signal: item.signal,
    contribution: item.points,
    max: item.max,
    reason: item.reason,
    evidence_refs: item.evidence_refs,
    source: SOURCE[item.signal]!,
    policy_version: state.risk!.policy_version,
    timestamp,
  }));
  const needsReview = state.risk.decision === 'NEEDS_REVIEW';
  return {
    value: {
      schema_version: '1.0.0',
      case_id: state.case_id,
      order_id: order.order_id,
      seller_id: order.seller_id,
      listing_id: order.listing_id,
      customer_id: order.customer_id,
      reason: state.request.reason,
      evidence: state.context.evidence,
      status: 'DECIDED',
      revision: 1,
      raw_contribution_total: state.risk.raw_contribution_total,
      risk_score: state.risk.score,
      policy_version: state.risk.policy_version,
      decision: state.risk.decision,
      priority: state.risk.priority,
      contributions: events,
      review_status: needsReview ? 'OPEN' : 'NOT_APPLICABLE',
      reviewer_disposition: null,
      explanation_status: needsReview ? 'PENDING' : 'NOT_REQUESTED',
      explanation: null,
      error: null,
      timeline: [
        timeline(state.case_id, 'RETURN_RECEIVED', timestamp),
        timeline(state.case_id, 'POLICY_DECIDED', timestamp),
        ...(needsReview
          ? [
              {
                ...timeline(state.case_id, 'POLICY_DECIDED', timestamp),
                event_id: `${state.case_id}-REVIEW_REQUESTED`,
                type: 'REVIEW_REQUESTED' as const,
                message: 'REVIEW_REQUESTED',
              },
            ]
          : []),
      ],
      created_at: timestamp,
      updated_at: timestamp,
    },
    events,
  };
}
