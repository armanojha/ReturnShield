import type { Evidence, Listing, Order, Seller, Customer, Repositories } from '@returnshield/data';

export interface ReturnRequestInput {
  schema_version: '1.0.0';
  order_id: string;
  reason: 'NOT_AS_DESCRIBED' | 'DAMAGED' | 'WRONG_ITEM' | 'NOT_RECEIVED' | 'CHANGED_MIND';
  evidence: Evidence[];
}

export interface ReturnContext {
  order?: Order;
  seller?: Seller;
  listing?: Listing;
  customer?: Customer;
  evidence: Evidence[];
  missing_fields: string[];
}

function suffix(orderId: string): string {
  return orderId.replace(/^ORDER-/, '');
}

function evidence(
  id: string,
  kind: Evidence['kind'],
  sourceId: string,
  text: string,
  at: string,
): Evidence {
  return {
    schema_version: '1.0.0',
    evidence_id: id,
    kind,
    source_id: sourceId,
    text,
    observed_at: at,
  };
}

export async function fetchReturnContext(
  repositories: Repositories,
  request: ReturnRequestInput,
  observedAt = new Date().toISOString(),
): Promise<ReturnContext> {
  const order = await repositories.orders.get(request.order_id);
  if (!order) return { evidence: [...request.evidence], missing_fields: ['order'] };
  const [seller, listing, customer] = await Promise.all([
    repositories.sellers.get(order.seller_id),
    repositories.listings.get(order.listing_id),
    repositories.customers.get(order.customer_id),
  ]);
  const missing_fields = [
    ...(seller ? [] : ['seller']),
    ...(listing ? [] : ['listing']),
    ...(customer ? [] : ['customer']),
  ];
  const tag = suffix(order.order_id);
  const generated: Evidence[] = [];
  if (seller)
    generated.push(
      evidence(
        `EV-${tag}-seller`,
        'SELLER_HISTORY',
        seller.seller_id,
        `Prior 90-day return_rate=${seller.return_rate}; dispute_count=${seller.dispute_count}; complete synthetic history.`,
        observedAt,
      ),
    );
  if (listing) {
    generated.push(
      evidence(
        `EV-${tag}-listing`,
        'LISTING_CONTENT',
        listing.listing_id,
        `Validated listing status=${listing.status}.`,
        observedAt,
      ),
    );
    generated.push(
      evidence(
        `EV-${tag}-category`,
        'CATEGORY_POLICY',
        listing.listing_id,
        `Listing category=${listing.category}; policy 1.0.0 adds 15 only for ELECTRONICS.`,
        observedAt,
      ),
    );
  }
  if (customer)
    generated.push(
      evidence(
        `EV-${tag}-customer`,
        'CUSTOMER_HISTORY',
        customer.customer_id,
        `Prior 30-day recent_returns=${customer.recent_returns}; complete synthetic history.`,
        observedAt,
      ),
    );
  generated.push(
    evidence(
      `EV-${tag}-return`,
      'ORDER_RECORD',
      order.order_id,
      `Order status=${order.status}; submitted reason=${request.reason}.`,
      observedAt,
    ),
  );
  return {
    order,
    ...(seller ? { seller } : {}),
    ...(listing ? { listing } : {}),
    ...(customer ? { customer } : {}),
    evidence: [...generated, ...request.evidence],
    missing_fields,
  };
}
