import type { IdempotencyStoreClient } from '../../src/idempotency/store.js';
import type { IdempotencyRecord } from '../../src/idempotency/types.js';

export class InMemoryIdempotencyStore implements IdempotencyStoreClient {
  private readonly records = new Map<string, IdempotencyRecord>();
  private id(pk: string, sk: string) {
    return `${pk}\u0000${sk}`;
  }
  async putIfAbsent(record: IdempotencyRecord) {
    const id = this.id(record.pk, record.sk);
    if (this.records.has(id)) return 'ALREADY_EXISTS' as const;
    this.records.set(id, structuredClone(record));
    return 'CREATED' as const;
  }
  async get(pk: string, sk: string) {
    const value = this.records.get(this.id(pk, sk));
    return value ? structuredClone(value) : undefined;
  }
  async complete(pk: string, sk: string, hash: string, result: unknown, logicalId: string | null) {
    const value = this.records.get(this.id(pk, sk));
    if (!value || value.status !== 'IN_PROGRESS' || value.payload_hash !== hash)
      return 'STALE' as const;
    this.records.set(this.id(pk, sk), {
      ...value,
      status: 'COMPLETED',
      result,
      logical_id: logicalId,
      updated_at: new Date().toISOString(),
    });
    return 'UPDATED' as const;
  }
  async markFailedRecoverable(pk: string, sk: string, hash: string) {
    const value = this.records.get(this.id(pk, sk));
    if (!value || value.status !== 'IN_PROGRESS' || value.payload_hash !== hash)
      return 'STALE' as const;
    this.records.set(this.id(pk, sk), {
      ...value,
      status: 'FAILED_RECOVERABLE',
      updated_at: new Date().toISOString(),
    });
    return 'UPDATED' as const;
  }
  async resume(pk: string, sk: string, hash: string) {
    const value = this.records.get(this.id(pk, sk));
    if (!value || value.status !== 'FAILED_RECOVERABLE' || value.payload_hash !== hash)
      return 'LOST_RACE' as const;
    this.records.set(this.id(pk, sk), {
      ...value,
      status: 'IN_PROGRESS',
      updated_at: new Date().toISOString(),
    });
    return 'RESUMED' as const;
  }
}
