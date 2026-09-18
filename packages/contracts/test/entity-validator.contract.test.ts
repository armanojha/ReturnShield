import { describe, expect, it } from 'vitest';

import { assertValidEntity, validateEntity } from '../src/index.js';

const seller = {
  schema_version: '1.0.0',
  seller_id: 'SELLER-contract-test',
  trust_score: 95,
  listing_flags: 0,
  return_rate: 0.02,
  dispute_count: 0,
  cases: [],
} as const;

describe('entity validators', () => {
  it('accepts an entity that satisfies the frozen definition', () => {
    expect(assertValidEntity('Seller', seller)).toEqual(seller);
  });

  it('rejects version drift and undeclared fields', () => {
    expect(validateEntity('Seller', { ...seller, schema_version: '2.0.0' }).valid).toBe(false);
    expect(validateEntity('Seller', { ...seller, unexpected: true }).valid).toBe(false);
  });
});
