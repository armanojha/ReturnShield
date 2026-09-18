import { assertValidEntity } from '@returnshield/contracts';
import type { Customer, Listing, Order, Seller } from '@returnshield/data';
import storiesFile from '../../../contracts/seeds/stories.json';

export interface SeedExpectedResult {
  story_id: string;
  case_id: string;
  raw_contribution_total: number;
  risk_score: number;
  decision: 'AUTO_APPROVE' | 'NEEDS_REVIEW';
  priority: 'NONE' | 'NORMAL' | 'HIGH';
}
export interface SeedDataset {
  schema_version: '1.0.0';
  policy_version: '1.0.0';
  generated_from: 'contracts/seeds/stories.json';
  sellers: Seller[];
  listings: Listing[];
  customers: Customer[];
  orders: Order[];
  expected_results: SeedExpectedResult[];
  expected_initial_counts: {
    sellers: 3;
    listings: 3;
    customers: 3;
    orders: 3;
    return_cases: 0;
    risk_events: 0;
  };
}

export function buildSeedDataset(): SeedDataset {
  const stories = storiesFile.stories;
  if (stories.length !== 3)
    throw new Error(`Expected 3 frozen stories, received ${stories.length}`);
  const sellers = stories.map((story) => assertValidEntity<Seller>('Seller', story.seller));
  const listings = stories.map((story) => assertValidEntity<Listing>('Listing', story.listing));
  const customers = stories.map((story) => assertValidEntity<Customer>('Customer', story.customer));
  const orders = stories.map((story) => assertValidEntity<Order>('Order', story.order));
  const expected_results = stories.map((story) => ({
    story_id: story.story_id,
    case_id: story.expected_case.case_id,
    raw_contribution_total: story.expected_risk_result.raw_contribution_total,
    risk_score: story.expected_risk_result.score,
    decision: story.expected_risk_result.decision,
    priority: story.expected_risk_result.priority,
  })) as SeedExpectedResult[];
  return {
    schema_version: '1.0.0',
    policy_version: '1.0.0',
    generated_from: 'contracts/seeds/stories.json',
    sellers,
    listings,
    customers,
    orders,
    expected_results,
    expected_initial_counts: {
      sellers: 3,
      listings: 3,
      customers: 3,
      orders: 3,
      return_cases: 0,
      risk_events: 0,
    },
  };
}

export function verifySeedRelationships(dataset: SeedDataset): string[] {
  const errors: string[] = [];
  const sellerIds = new Set(dataset.sellers.map((item) => item.seller_id));
  const listingIds = new Set(dataset.listings.map((item) => item.listing_id));
  const customerIds = new Set(dataset.customers.map((item) => item.customer_id));
  for (const listing of dataset.listings)
    if (!sellerIds.has(listing.seller_id))
      errors.push(`Listing ${listing.listing_id} has unknown seller`);
  for (const order of dataset.orders) {
    if (!sellerIds.has(order.seller_id)) errors.push(`Order ${order.order_id} has unknown seller`);
    if (!listingIds.has(order.listing_id))
      errors.push(`Order ${order.order_id} has unknown listing`);
    if (!customerIds.has(order.customer_id))
      errors.push(`Order ${order.order_id} has unknown customer`);
    const listing = dataset.listings.find((item) => item.listing_id === order.listing_id);
    if (listing?.seller_id !== order.seller_id)
      errors.push(`Order ${order.order_id} seller disagrees with listing`);
  }
  return errors;
}

export const SEED_DATASET = buildSeedDataset();
