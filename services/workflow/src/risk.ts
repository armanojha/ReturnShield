import type { ReturnContext, ReturnRequestInput } from '@returnshield/context';
import type { RiskEvaluationInput } from '@returnshield/risk-policy';

export function toRiskInput(
  context: ReturnContext,
  request: ReturnRequestInput,
): RiskEvaluationInput {
  return {
    history_complete: context.missing_fields.length === 0,
    seller: context.seller
      ? { return_rate: context.seller.return_rate, dispute_count: context.seller.dispute_count }
      : null,
    listing: context.listing
      ? { status: context.listing.status, category: context.listing.category }
      : null,
    customer: context.customer ? { recent_returns: context.customer.recent_returns } : null,
    order: context.order ? { status: context.order.status } : null,
    request: { reason: request.reason },
    evidence: context.evidence.map(({ evidence_id, kind }) => ({ evidence_id, kind })),
  };
}
