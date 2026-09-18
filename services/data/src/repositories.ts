import { assertValidEntity } from '@returnshield/contracts';
import type { EntityDefinitionName } from '@returnshield/contracts';

import { RepositoryConflictError, RepositoryValidationError } from './errors.js';
import { GSI, indexesFor, key, keyFor } from './keys.js';
import type { RepositoryStore, StoredItem } from './store.js';
import type { Customer, Entity, Listing, Order, ReturnCase, RiskEvent, Seller } from './types.js';

const METADATA = new Set([
  'pk',
  'sk',
  'entity_type',
  'gsi1pk',
  'gsi1sk',
  'gsi2pk',
  'gsi2sk',
  'gsi3pk',
  'gsi3sk',
  'gsi4pk',
  'gsi4sk',
]);

export function toStoredItem<T extends Entity>(name: EntityDefinitionName, entity: T): StoredItem {
  try {
    assertValidEntity(name, entity);
  } catch (error) {
    throw new RepositoryValidationError(
      error instanceof Error ? error.message : 'Entity validation failed',
    );
  }
  return {
    ...(entity as unknown as Record<string, unknown>),
    ...keyFor(entity),
    ...('risk_event_id' in entity
      ? {}
      : indexesFor(entity as Seller | Listing | Customer | Order | ReturnCase)),
    entity_type: name,
  } as StoredItem;
}

function entity<T>(name: EntityDefinitionName, item: StoredItem): T {
  const value = Object.fromEntries(Object.entries(item).filter(([field]) => !METADATA.has(field)));
  try {
    return assertValidEntity<T>(name, value);
  } catch (error) {
    throw new RepositoryValidationError(
      error instanceof Error ? error.message : 'Stored entity validation failed',
    );
  }
}

class EntityRepository<T extends Entity> {
  constructor(
    private readonly store: RepositoryStore,
    private readonly name: EntityDefinitionName,
    private readonly makeKey: (id: string) => { pk: string; sk: string },
  ) {}
  async create(value: T): Promise<T> {
    if ((await this.store.put(toStoredItem(this.name, value), true)) === 'CONFLICT')
      throw new RepositoryConflictError(`${this.name} already exists`);
    return value;
  }
  async put(value: T): Promise<T> {
    await this.store.put(toStoredItem(this.name, value));
    return value;
  }
  async get(id: string): Promise<T | undefined> {
    const keys = this.makeKey(id);
    const found = await this.store.get(keys.pk, keys.sk);
    return found ? entity<T>(this.name, found) : undefined;
  }
}

export class SellerRepository extends EntityRepository<Seller> {
  constructor(store: RepositoryStore) {
    super(store, 'Seller', key.seller);
  }
}
export class ListingRepository extends EntityRepository<Listing> {
  constructor(private readonly data: RepositoryStore) {
    super(data, 'Listing', key.listing);
  }
  async listBySeller(sellerId: string): Promise<Listing[]> {
    return (
      await this.data.query({
        indexName: GSI.BY_SELLER,
        partitionName: 'gsi1pk',
        partitionValue: `SELLER#${sellerId}`,
        beginsWith: 'LISTING#',
      })
    ).map((item) => entity<Listing>('Listing', item));
  }
}
export class CustomerRepository extends EntityRepository<Customer> {
  constructor(store: RepositoryStore) {
    super(store, 'Customer', key.customer);
  }
}
export class OrderRepository extends EntityRepository<Order> {
  constructor(private readonly data: RepositoryStore) {
    super(data, 'Order', key.order);
  }
  async listBySeller(sellerId: string): Promise<Order[]> {
    return this.byIndex(GSI.BY_SELLER, 'gsi1pk', `SELLER#${sellerId}`);
  }
  async listByCustomer(customerId: string): Promise<Order[]> {
    return this.byIndex(GSI.BY_CUSTOMER, 'gsi2pk', `CUSTOMER#${customerId}`);
  }
  private async byIndex(indexName: string, partitionName: string, partitionValue: string) {
    return (
      await this.data.query({ indexName, partitionName, partitionValue, beginsWith: 'ORDER#' })
    ).map((item) => entity<Order>('Order', item));
  }
}

const IMMUTABLE_POLICY_FIELDS: (keyof ReturnCase)[] = [
  'raw_contribution_total',
  'risk_score',
  'policy_version',
  'decision',
  'priority',
  'contributions',
];

export class ReturnCaseRepository extends EntityRepository<ReturnCase> {
  constructor(private readonly data: RepositoryStore) {
    super(data, 'ReturnCase', key.returnCase);
  }
  async getByOrderId(orderId: string): Promise<ReturnCase | undefined> {
    const items = await this.data.query({
      indexName: GSI.BY_ORDER,
      partitionName: 'gsi3pk',
      partitionValue: `ORDER#${orderId}`,
      beginsWith: 'CASE#',
    });
    if (items.length > 1)
      throw new RepositoryValidationError(`Multiple cases found for order ${orderId}`);
    return items[0] ? entity<ReturnCase>('ReturnCase', items[0]) : undefined;
  }
  async listQueue(): Promise<ReturnCase[]> {
    return (
      await this.data.query({
        indexName: GSI.CASE_QUEUE,
        partitionName: 'gsi4pk',
        partitionValue: 'CASE_QUEUE',
      })
    ).map((item) => entity<ReturnCase>('ReturnCase', item));
  }
  async update(next: ReturnCase, expectedRevision: number): Promise<ReturnCase> {
    const current = await this.get(next.case_id);
    if (!current) throw new RepositoryConflictError(`ReturnCase ${next.case_id} does not exist`);
    if (current.status === 'DECIDED') {
      for (const field of IMMUTABLE_POLICY_FIELDS) {
        if (JSON.stringify(current[field]) !== JSON.stringify(next[field]))
          throw new RepositoryConflictError(`Cannot mutate decided policy field ${String(field)}`);
      }
    }
    if (next.revision !== expectedRevision + 1)
      throw new RepositoryConflictError('Case revision must increment exactly once');
    if (
      (await this.data.updateCase(toStoredItem('ReturnCase', next), expectedRevision)) ===
      'CONFLICT'
    )
      throw new RepositoryConflictError('Case revision conflict');
    return next;
  }
  async createDecision(value: ReturnCase, events: RiskEvent[]): Promise<ReturnCase> {
    const items = [
      toStoredItem('ReturnCase', value),
      ...events.map((event) => toStoredItem('RiskEvent', event)),
    ];
    if ((await this.data.transactPut(items)) === 'CONFLICT')
      throw new RepositoryConflictError('Case or risk event already exists');
    return value;
  }
}

export class RiskEventRepository {
  constructor(private readonly data: RepositoryStore) {}
  async create(value: RiskEvent): Promise<RiskEvent> {
    if ((await this.data.put(toStoredItem('RiskEvent', value), true)) === 'CONFLICT')
      throw new RepositoryConflictError('RiskEvent already exists');
    return value;
  }
  async listByCase(caseId: string): Promise<RiskEvent[]> {
    return (
      await this.data.query({ partitionValue: `CASE#${caseId}`, beginsWith: 'RISKEVENT#' })
    ).map((item) => entity<RiskEvent>('RiskEvent', item));
  }
}

export interface Repositories {
  sellers: SellerRepository;
  listings: ListingRepository;
  customers: CustomerRepository;
  orders: OrderRepository;
  cases: ReturnCaseRepository;
  riskEvents: RiskEventRepository;
}
export function createRepositories(store: RepositoryStore): Repositories {
  return {
    sellers: new SellerRepository(store),
    listings: new ListingRepository(store),
    customers: new CustomerRepository(store),
    orders: new OrderRepository(store),
    cases: new ReturnCaseRepository(store),
    riskEvents: new RiskEventRepository(store),
  };
}
