import storiesFile from '../../../contracts/seeds/stories.json';
import { describe, expect, it } from 'vitest';

import { RepositoryConflictError, createRepositories } from '../src/index.js';
import type { Customer, Listing, Order, ReturnCase, RiskEvent, Seller } from '../src/types.js';
import { InMemoryRepositoryStore } from './support/in-memory-store.js';

const story = storiesFile.stories[2]!;
const seller = story.seller as Seller;
const listing = story.listing as unknown as Listing;
const customer = story.customer as Customer;
const order = story.order as Order;
const returnCase = story.expected_case as unknown as ReturnCase;
const riskEvents = returnCase.contributions as RiskEvent[];

describe('operational repositories', () => {
  it('round-trips Seller, Listing, Customer and Order through validated records', async () => {
    const repositories = createRepositories(new InMemoryRepositoryStore());
    await repositories.sellers.create(seller);
    await repositories.listings.create(listing);
    await repositories.customers.create(customer);
    await repositories.orders.create(order);
    expect(await repositories.sellers.get(seller.seller_id)).toEqual(seller);
    expect(await repositories.listings.get(listing.listing_id)).toEqual(listing);
    expect(await repositories.customers.get(customer.customer_id)).toEqual(customer);
    expect(await repositories.orders.get(order.order_id)).toEqual(order);
    expect(await repositories.listings.listBySeller(seller.seller_id)).toEqual([listing]);
    expect(await repositories.orders.listBySeller(seller.seller_id)).toEqual([order]);
    expect(await repositories.orders.listByCustomer(customer.customer_id)).toEqual([order]);
  });

  it('rejects duplicate create-only writes', async () => {
    const repositories = createRepositories(new InMemoryRepositoryStore());
    await repositories.sellers.create(seller);
    await expect(repositories.sellers.create(seller)).rejects.toBeInstanceOf(
      RepositoryConflictError,
    );
  });

  it('atomically creates a case and its five stable risk events', async () => {
    const repositories = createRepositories(new InMemoryRepositoryStore());
    await repositories.cases.createDecision(returnCase, riskEvents);
    expect(await repositories.cases.get(returnCase.case_id)).toEqual(returnCase);
    expect(await repositories.cases.getByOrderId(returnCase.order_id)).toEqual(returnCase);
    expect(
      (await repositories.riskEvents.listByCase(returnCase.case_id))
        .map((item) => item.signal)
        .sort(),
    ).toEqual(riskEvents.map((item) => item.signal).sort());
    await expect(repositories.cases.createDecision(returnCase, riskEvents)).rejects.toBeInstanceOf(
      RepositoryConflictError,
    );
  });

  it('sorts the case queue by inverted timestamp and case id', async () => {
    const repositories = createRepositories(new InMemoryRepositoryStore());
    const later = {
      ...returnCase,
      case_id: 'CASE-later',
      order_id: 'ORDER-later',
      created_at: '2026-09-02T12:00:00Z',
      updated_at: '2026-09-02T12:00:00Z',
      contributions: returnCase.contributions.map((event) => ({
        ...event,
        case_id: 'CASE-later',
        risk_event_id: event.risk_event_id.replace('CASE-high', 'CASE-later'),
      })),
    } as ReturnCase;
    await repositories.cases.create(returnCase);
    await repositories.cases.create(later);
    expect((await repositories.cases.listQueue()).map((item) => item.case_id)).toEqual([
      'CASE-later',
      returnCase.case_id,
    ]);
  });

  it('uses optimistic revision and preserves decided policy fields', async () => {
    const repositories = createRepositories(new InMemoryRepositoryStore());
    await repositories.cases.create(returnCase);
    const updated = {
      ...returnCase,
      revision: returnCase.revision + 1,
      explanation_status: 'UNAVAILABLE',
      explanation: null,
    } as ReturnCase;
    await expect(repositories.cases.update(updated, returnCase.revision)).resolves.toEqual(updated);
    await expect(
      repositories.cases.update(
        { ...updated, revision: updated.revision + 1 },
        returnCase.revision,
      ),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
    await expect(
      repositories.cases.update(
        { ...updated, revision: updated.revision + 1, risk_score: 99 },
        updated.revision,
      ),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
  });

  it('distinguishes a missing relationship from a verified empty query', async () => {
    const repositories = createRepositories(new InMemoryRepositoryStore());
    expect(await repositories.cases.getByOrderId('ORDER-missing')).toBeUndefined();
    expect(await repositories.orders.listByCustomer('CUSTOMER-with-no-orders')).toEqual([]);
  });
});
