/**
 * Idempotency record storage port + DynamoDB implementation (task
 * P2-IDEM-01).
 *
 * `IdempotencyStoreClient` is the seam `reserve.ts` programs against.
 * Production code (a future Phase 03/05 Lambda) constructs
 * `DynamoDbIdempotencyStore` with a real `DynamoDBDocumentClient`. Tests
 * inject a test-only in-memory adapter implementing the same interface
 * (see `test/support/in-memory-idempotency-store.ts`) — this repository
 * does not use a process-local map in the production implementation, only
 * in the test double, per the task instructions.
 *
 * Every mutating operation here is a single conditional DynamoDB command:
 * atomicity of "reserve the key before side effects" and "concurrent
 * reservations must have one winner" both come directly from DynamoDB's
 * conditional-write guarantee (`attribute_not_exists` / attribute-equality
 * conditions), not from any locking done in this module.
 */
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import type { IdempotencyRecord, IdempotencyScope, IdempotencyStatus } from './types.js';

export interface IdempotencyStoreClient {
  /**
   * Atomically creates the reservation item. Returns `'CREATED'` on success
   * or `'ALREADY_EXISTS'` if an item with this key already exists — never
   * throws for that expected case.
   */
  putIfAbsent(record: IdempotencyRecord): Promise<'CREATED' | 'ALREADY_EXISTS'>;

  get(pk: string, sk: string): Promise<IdempotencyRecord | undefined>;

  /**
   * Conditionally transitions `IN_PROGRESS` -> `COMPLETED`, only if the
   * stored `payload_hash` still matches (guards against a resumed attempt
   * racing a payload it no longer represents). Returns `'UPDATED'` or
   * `'STALE'` (condition failed — never throws for that expected case).
   */
  complete(
    pk: string,
    sk: string,
    expectedPayloadHash: string,
    result: unknown,
    logicalId: string | null,
  ): Promise<'UPDATED' | 'STALE'>;

  /** Conditionally transitions `IN_PROGRESS` -> `FAILED_RECOVERABLE`. */
  markFailedRecoverable(
    pk: string,
    sk: string,
    expectedPayloadHash: string,
  ): Promise<'UPDATED' | 'STALE'>;

  /**
   * Conditionally transitions `FAILED_RECOVERABLE` -> `IN_PROGRESS` for the
   * SAME payload hash, so a retry resumes the original attempt rather than
   * starting a second logical operation. Returns `'RESUMED'` if this call
   * won the race, `'LOST_RACE'` if another retrier already resumed it.
   */
  resume(pk: string, sk: string, expectedPayloadHash: string): Promise<'RESUMED' | 'LOST_RACE'>;
}

export interface DynamoDbIdempotencyStoreProps {
  tableName: string;
  documentClient?: DynamoDBDocumentClient;
}

const STATUS_ATTR = 'status';

export class DynamoDbIdempotencyStore implements IdempotencyStoreClient {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor(props: DynamoDbIdempotencyStoreProps) {
    this.tableName = props.tableName;
    this.client = props.documentClient ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async putIfAbsent(record: IdempotencyRecord): Promise<'CREATED' | 'ALREADY_EXISTS'> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: record,
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );
      return 'CREATED';
    } catch (error) {
      if (isConditionalCheckFailed(error)) return 'ALREADY_EXISTS';
      throw error;
    }
  }

  async get(pk: string, sk: string): Promise<IdempotencyRecord | undefined> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk, sk }, ConsistentRead: true }),
    );
    return result.Item as IdempotencyRecord | undefined;
  }

  async complete(
    pk: string,
    sk: string,
    expectedPayloadHash: string,
    result: unknown,
    logicalId: string | null,
  ): Promise<'UPDATED' | 'STALE'> {
    return this.transitionStatus(
      pk,
      sk,
      'IN_PROGRESS',
      expectedPayloadHash,
      {
        '#status': STATUS_ATTR,
      },
      {
        ':new_status': 'COMPLETED' satisfies IdempotencyStatus,
        ':result': result,
        ':logical_id': logicalId,
      },
      'SET #status = :new_status, #result = :result, logical_id = :logical_id, updated_at = :now',
      {
        '#result': 'result',
      },
    );
  }

  async markFailedRecoverable(
    pk: string,
    sk: string,
    expectedPayloadHash: string,
  ): Promise<'UPDATED' | 'STALE'> {
    return this.transitionStatus(
      pk,
      sk,
      'IN_PROGRESS',
      expectedPayloadHash,
      { '#status': STATUS_ATTR },
      { ':new_status': 'FAILED_RECOVERABLE' satisfies IdempotencyStatus },
      'SET #status = :new_status, updated_at = :now',
      {},
    );
  }

  async resume(
    pk: string,
    sk: string,
    expectedPayloadHash: string,
  ): Promise<'RESUMED' | 'LOST_RACE'> {
    const outcome = await this.transitionStatus(
      pk,
      sk,
      'FAILED_RECOVERABLE',
      expectedPayloadHash,
      { '#status': STATUS_ATTR },
      { ':new_status': 'IN_PROGRESS' satisfies IdempotencyStatus },
      'SET #status = :new_status, updated_at = :now',
      {},
    );
    return outcome === 'UPDATED' ? 'RESUMED' : 'LOST_RACE';
  }

  private async transitionStatus(
    pk: string,
    sk: string,
    expectedStatus: IdempotencyStatus,
    expectedPayloadHash: string,
    extraNames: Record<string, string>,
    extraValues: Record<string, unknown>,
    updateExpression: string,
    resultNames: Record<string, string>,
  ): Promise<'UPDATED' | 'STALE'> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk, sk },
          ConditionExpression: '#status = :expected_status AND payload_hash = :expected_hash',
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: { ...extraNames, ...resultNames },
          ExpressionAttributeValues: {
            ...extraValues,
            ':expected_status': expectedStatus,
            ':expected_hash': expectedPayloadHash,
            ':now': new Date().toISOString(),
          },
        }),
      );
      return 'UPDATED';
    } catch (error) {
      if (isConditionalCheckFailed(error)) return 'STALE';
      throw error;
    }
  }
}

function isConditionalCheckFailed(error: unknown): boolean {
  return (
    error instanceof ConditionalCheckFailedException ||
    (error instanceof Error && error.name === 'ConditionalCheckFailedException')
  );
}

export type { IdempotencyScope };
