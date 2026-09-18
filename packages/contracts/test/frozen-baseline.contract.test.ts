import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CONTRACT_SOURCE_HASHES, getHttpValidator } from '../src/index.js';
import type { HttpDefinitionName } from '../src/index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function lfHash(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

describe('frozen Phase 00 baseline', () => {
  it('derives every validator from the unmodified contract files', async () => {
    const entries = Object.entries(CONTRACT_SOURCE_HASHES);
    expect(entries.length).toBeGreaterThan(0);

    for (const [relative, expected] of entries) {
      const source = await readFile(join(repoRoot, 'contracts', relative), 'utf8');
      expect(lfHash(source), `contracts/${relative} drifted from the generated mirror`).toBe(
        expected,
      );
    }
  });

  it('exposes a compiled validator for every frozen HTTP definition', () => {
    const definitions: HttpDefinitionName[] = [
      'Error',
      'HealthResponse',
      'ListingRequest',
      'ListingResponse',
      'ReturnRequest',
      'ReturnResponse',
      'CaseResponse',
      'SellerResponse',
      'CaseQuery',
      'CasesResponse',
      'DashboardResponse',
      'DecisionRequest',
      'DecisionResponse',
    ];

    for (const definition of definitions) {
      expect(typeof getHttpValidator(definition)).toBe('function');
    }
  });

  it('resolves cross-bundle references offline', () => {
    // CaseResponse.data $refs the data entity bundle; compiling it proves the
    // entity schema is registered in the same Ajv instance.
    expect(() => getHttpValidator('CaseResponse')).not.toThrow();
  });

  it('rejects an unknown definition name rather than validating loosely', () => {
    expect(() => getHttpValidator('NotAContract' as HttpDefinitionName)).toThrow();
  });
});
