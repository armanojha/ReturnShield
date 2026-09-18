import type { Customer, Listing, Order, ReturnCase, RiskEvent, Seller } from './types.js';

export const GSI = {
  BY_SELLER: 'gsi1-by-seller',
  BY_CUSTOMER: 'gsi2-by-customer',
  BY_ORDER: 'gsi3-by-order',
  CASE_QUEUE: 'gsi4-case-queue',
} as const;

export const key = {
  seller: (id: string) => ({ pk: `SELLER#${id}`, sk: `SELLER#${id}` }),
  listing: (id: string) => ({ pk: `LISTING#${id}`, sk: `LISTING#${id}` }),
  customer: (id: string) => ({ pk: `CUSTOMER#${id}`, sk: `CUSTOMER#${id}` }),
  order: (id: string) => ({ pk: `ORDER#${id}`, sk: `ORDER#${id}` }),
  returnCase: (id: string) => ({ pk: `CASE#${id}`, sk: `CASE#${id}` }),
  riskEvent: (value: Pick<RiskEvent, 'case_id' | 'signal' | 'policy_version'>) => ({
    pk: `CASE#${value.case_id}`,
    sk: `RISKEVENT#${value.signal}#${value.policy_version}`,
  }),
};

function invertedTime(timestamp: string): string {
  const millis = Date.parse(timestamp);
  if (!Number.isFinite(millis)) throw new Error(`Invalid case timestamp: ${timestamp}`);
  return String(9_999_999_999_999 - millis).padStart(13, '0');
}

export function indexesFor(
  entity: Seller | Listing | Customer | Order | ReturnCase,
): Record<string, string> {
  if ('listing_id' in entity && 'analysis' in entity) {
    const listing = entity as Listing;
    return { gsi1pk: `SELLER#${listing.seller_id}`, gsi1sk: `LISTING#${listing.listing_id}` };
  }
  if ('order_id' in entity && 'timestamp' in entity && !('case_id' in entity)) {
    const order = entity as Order;
    return {
      gsi1pk: `SELLER#${order.seller_id}`,
      gsi1sk: `ORDER#${order.order_id}`,
      gsi2pk: `CUSTOMER#${order.customer_id}`,
      gsi2sk: `ORDER#${order.order_id}`,
    };
  }
  if ('case_id' in entity) {
    const value = entity as ReturnCase;
    return {
      gsi1pk: `SELLER#${value.seller_id}`,
      gsi1sk: `CASE#${value.case_id}`,
      gsi2pk: `CUSTOMER#${value.customer_id}`,
      gsi2sk: `CASE#${value.case_id}`,
      gsi3pk: `ORDER#${value.order_id}`,
      gsi3sk: `CASE#${value.case_id}`,
      gsi4pk: 'CASE_QUEUE',
      gsi4sk: `${invertedTime(value.created_at)}#${value.case_id}`,
    };
  }
  return {};
}

export function keyFor(entity: Seller | Listing | Customer | Order | ReturnCase | RiskEvent) {
  if ('risk_event_id' in entity) return key.riskEvent(entity);
  if ('case_id' in entity) return key.returnCase(entity.case_id);
  if ('order_id' in entity) return key.order(entity.order_id);
  if ('customer_id' in entity) return key.customer((entity as Customer).customer_id);
  if ('listing_id' in entity) return key.listing((entity as Listing).listing_id);
  return key.seller((entity as Seller).seller_id);
}
