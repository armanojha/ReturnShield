import type { QueryInput, RepositoryStore, StoredItem } from '@returnshield/data';

/** Test-only `RepositoryStore` with the same revision semantics as DynamoDB. */
export class InMemoryRepositoryStore implements RepositoryStore {
  readonly items = new Map<string, StoredItem>();
  private id(pk: string, sk: string) {
    return `${pk}\u0000${sk}`;
  }
  async put(item: StoredItem, createOnly = false): Promise<'WRITTEN' | 'CONFLICT'> {
    const id = this.id(item.pk, item.sk);
    if (createOnly && this.items.has(id)) return 'CONFLICT';
    this.items.set(id, structuredClone(item));
    return 'WRITTEN';
  }
  async get(pk: string, sk: string) {
    const value = this.items.get(this.id(pk, sk));
    return value ? structuredClone(value) : undefined;
  }
  async query(input: QueryInput) {
    const partition = input.partitionName ?? 'pk';
    return [...this.items.values()]
      .filter((item) => item[partition] === input.partitionValue)
      .map((item) => structuredClone(item));
  }
  async scan(entityType: string) {
    return [...this.items.values()]
      .filter((item) => item.entity_type === entityType)
      .map((item) => structuredClone(item));
  }
  async updateCase(item: StoredItem, expectedRevision: number): Promise<'WRITTEN' | 'CONFLICT'> {
    const existing = this.items.get(this.id(item.pk, item.sk));
    if (!existing || existing.revision !== expectedRevision) return 'CONFLICT';
    this.items.set(this.id(item.pk, item.sk), structuredClone(item));
    return 'WRITTEN';
  }
  async transactPut(items: StoredItem[]): Promise<'WRITTEN' | 'CONFLICT'> {
    if (items.some((item) => this.items.has(this.id(item.pk, item.sk)))) return 'CONFLICT';
    for (const item of items) this.items.set(this.id(item.pk, item.sk), structuredClone(item));
    return 'WRITTEN';
  }
  async delete(pk: string, sk: string) {
    this.items.delete(this.id(pk, sk));
  }
}
