import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { keyFor, key, toStoredItem } from '@returnshield/data';
import type { Entity, RiskEvent } from '@returnshield/data';
import { SEED_DATASET, verifySeedRelationships } from '@returnshield/seed-data';

export interface SeedTarget {
  put(item: Record<string, unknown>): Promise<void>;
  get(pk: string, sk: string): Promise<Record<string, unknown> | undefined>;
  delete(pk: string, sk: string): Promise<void>;
  query(pk: string): Promise<Record<string, unknown>[]>;
}

export class DynamoDbSeedTarget implements SeedTarget {
  private readonly client: DynamoDBDocumentClient;
  constructor(
    private readonly tableName: string,
    options: { endpoint?: string; region?: string } = {},
  ) {
    this.client = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        ...(options.endpoint ? { endpoint: options.endpoint } : {}),
        ...(options.region ? { region: options.region } : {}),
      }),
    );
  }
  async put(item: Record<string, unknown>) {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item }));
  }
  async get(pk: string, sk: string) {
    const out = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk, sk }, ConsistentRead: true }),
    );
    return out.Item;
  }
  async delete(pk: string, sk: string) {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: { pk, sk } }));
  }
  async query(pk: string) {
    const out = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        ConsistentRead: true,
      }),
    );
    return out.Items ?? [];
  }
}

function record(entity: Entity): Record<string, unknown> {
  const name =
    'risk_event_id' in entity
      ? 'RiskEvent'
      : 'case_id' in entity
        ? 'ReturnCase'
        : 'order_id' in entity
          ? 'Order'
          : 'customer_id' in entity
            ? 'Customer'
            : 'listing_id' in entity
              ? 'Listing'
              : 'Seller';
  return toStoredItem(name, entity);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null)
    return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) => key === rightKeys[index] && deepEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

export function initialEntities(): Entity[] {
  return [
    ...SEED_DATASET.sellers,
    ...SEED_DATASET.listings,
    ...SEED_DATASET.customers,
    ...SEED_DATASET.orders,
  ];
}

export function resetKeys(): { pk: string; sk: string }[] {
  const direct = initialEntities().map(keyFor);
  const outcomes = SEED_DATASET.expected_results.flatMap((expected) => {
    const caseKey = key.returnCase(expected.case_id);
    const events = ['seller', 'listing', 'customer', 'return', 'category', 'context'].map(
      (signal) =>
        key.riskEvent({
          case_id: expected.case_id,
          signal: signal as RiskEvent['signal'],
          policy_version: '1.0.0',
        }),
    );
    const idem = {
      pk: `IDEMP#RETURN#ORDER-${expected.story_id}`,
      sk: `IDEMP#RETURN#ORDER-${expected.story_id}`,
    };
    return [caseKey, ...events, idem];
  });
  return [...direct, ...outcomes];
}

export async function loadSeeds(target: SeedTarget): Promise<void> {
  if (verifySeedRelationships(SEED_DATASET).length)
    throw new Error('Frozen seed relationships are invalid');
  for (const entity of initialEntities()) await target.put(record(entity));
}

export async function resetSeeds(target: SeedTarget): Promise<void> {
  for (const item of resetKeys()) await target.delete(item.pk, item.sk);
}

export async function verifySeeds(target: SeedTarget): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [...verifySeedRelationships(SEED_DATASET)];
  for (const entity of initialEntities()) {
    const expected = record(entity);
    const keys = keyFor(entity);
    const actual = await target.get(keys.pk, keys.sk);
    if (!actual) errors.push(`Missing ${keys.pk}`);
    else
      for (const [field, value] of Object.entries(expected))
        if (!deepEqual(actual[field], value)) errors.push(`${keys.pk} field ${field} differs`);
  }
  for (const expected of SEED_DATASET.expected_results) {
    const items = await target.query(`CASE#${expected.case_id}`);
    if (items.length !== 0)
      errors.push(`Expected no preloaded case/events for ${expected.case_id}`);
    const idempotencyKey = `IDEMP#RETURN#ORDER-${expected.story_id}`;
    if (await target.get(idempotencyKey, idempotencyKey))
      errors.push(`Expected no preloaded idempotency record for ${expected.story_id}`);
  }
  return { ok: errors.length === 0, errors };
}
