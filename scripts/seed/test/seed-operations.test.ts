import { describe, expect, it } from 'vitest';
import { loadSeeds, resetSeeds, verifySeeds, type SeedTarget } from '../src/operations.js';
import { assertSafeSeedTarget } from '../src/safety.js';

class MemoryTarget implements SeedTarget {
  items = new Map<string, Record<string, unknown>>();
  id(pk: string, sk: string) {
    return `${pk}\u0000${sk}`;
  }
  async put(item: Record<string, unknown>) {
    this.items.set(this.id(String(item.pk), String(item.sk)), structuredClone(item));
  }
  async get(pk: string, sk: string) {
    const value = this.items.get(this.id(pk, sk));
    return value ? structuredClone(value) : undefined;
  }
  async delete(pk: string, sk: string) {
    this.items.delete(this.id(pk, sk));
  }
  async query(pk: string) {
    return [...this.items.values()]
      .filter((item) => item.pk === pk)
      .map((item) => structuredClone(item));
  }
}

describe('safe seed lifecycle', () => {
  it('loads and verifies the exact dataset repeatedly', async () => {
    const target = new MemoryTarget();
    await loadSeeds(target);
    await loadSeeds(target);
    expect(target.items.size).toBe(12);
    expect(await verifySeeds(target)).toEqual({ ok: true, errors: [] });
  });
  it('resets only the known ReturnShield seed keys', async () => {
    const target = new MemoryTarget();
    await loadSeeds(target);
    target.items.set('UNRELATED\u0000UNRELATED', { pk: 'UNRELATED', sk: 'UNRELATED' });
    await resetSeeds(target);
    expect(target.items.size).toBe(1);
    expect(target.items.has('UNRELATED\u0000UNRELATED')).toBe(true);
  });
  it('refuses production, broad names, unsafe endpoints and unconfirmed reset', () => {
    expect(() =>
      assertSafeSeedTarget({ environment: 'prod', tableName: 'returnshield-prod-core' }, false),
    ).toThrow();
    expect(() =>
      assertSafeSeedTarget({ environment: 'dev', tableName: 'other-table' }, false),
    ).toThrow();
    expect(() =>
      assertSafeSeedTarget(
        {
          environment: 'dev',
          tableName: 'returnshield-dev-core',
          endpoint: 'http://localhost:8000',
        },
        false,
      ),
    ).toThrow();
    expect(() =>
      assertSafeSeedTarget({ environment: 'dev', tableName: 'returnshield-dev-core' }, true),
    ).toThrow();
    expect(
      assertSafeSeedTarget(
        {
          environment: 'dev',
          tableName: 'returnshield-dev-core',
          confirmation: 'returnshield-dev-core',
        },
        true,
      ),
    ).toEqual({ environment: 'dev', tableName: 'returnshield-dev-core' });
  });
});
