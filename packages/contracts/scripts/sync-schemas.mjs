#!/usr/bin/env node
/**
 * Mirrors the frozen Phase 00 JSON Schemas from `contracts/**` into
 * `packages/contracts/schemas/**` so application code can import them.
 *
 * The mirror is generated, git-ignored and byte-identical to the approved
 * baseline. Contracts are never re-authored by hand: this script is the only
 * sanctioned path from `contracts` into runtime code.
 *
 * Usage:
 *   node scripts/sync-schemas.mjs           copy (default, idempotent)
 *   node scripts/sync-schemas.mjs --check   verify mirror matches source, exit 1 on drift
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const repoRoot = resolve(packageRoot, '..', '..');
const sourceRoot = join(repoRoot, 'contracts');
const targetRoot = join(packageRoot, 'schemas');

/** Frozen Phase 00 artifacts consumed by runtime code, relative to contracts/. */
const FILES = [
  'api/http.schema.json',
  'api/openapi.json',
  'data/entities.schema.json',
  'risk/evaluation.schema.json',
  'risk/policy.json',
  'ai/models.schema.json',
  'seeds/stories.json',
];

const checkOnly = process.argv.includes('--check');

/** Hash on LF-normalised UTF-8, matching docs/product/baseline-manifest.json. */
function hash(text) {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

async function readIfPresent(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

const drift = [];
const manifest = {};

for (const relative of FILES) {
  const sourcePath = join(sourceRoot, relative);
  const targetPath = join(targetRoot, relative);

  const source = await readIfPresent(sourcePath);
  if (source === null) {
    console.error(`[contracts] missing frozen contract: contracts/${relative}`);
    process.exit(1);
  }

  const sourceHash = hash(source);
  manifest[relative] = sourceHash;

  const target = await readIfPresent(targetPath);
  const inSync = target !== null && hash(target) === sourceHash;

  if (checkOnly) {
    if (!inSync) drift.push(relative);
    continue;
  }

  if (!inSync) {
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, source, 'utf8');
  }
}

if (checkOnly) {
  if (drift.length > 0) {
    console.error('[contracts] mirror is stale or modified; run `npm run sync:schemas`:');
    for (const relative of drift) console.error(`  - ${relative}`);
    process.exit(1);
  }
  console.log(`[contracts] mirror matches all ${FILES.length} frozen contracts`);
  process.exit(0);
}

await mkdir(targetRoot, { recursive: true });
await writeFile(
  join(targetRoot, 'manifest.json'),
  `${JSON.stringify({ source: 'contracts', algorithm: 'sha256-lf-utf8', files: manifest }, null, 2)}\n`,
  'utf8',
);

// Emit a TypeScript module so consumers never depend on runtime JSON import
// attributes, which differ between Node ESM, esbuild and Vite.
const generatedDir = join(packageRoot, 'src', 'generated');
await mkdir(generatedDir, { recursive: true });

const entries = [];
for (const relative of FILES) {
  const identifier = relative
    .replace(/\.json$/, '')
    .replace(/[^A-Za-z0-9]+(.)/g, (_match, char) => char.toUpperCase());
  const json = JSON.parse(await readFile(join(sourceRoot, relative), 'utf8'));
  entries.push({ identifier, relative, json });
}

const body = [
  '// GENERATED FILE — do not edit.',
  '// Produced by packages/contracts/scripts/sync-schemas.mjs from the frozen',
  '// Phase 00 contracts in contracts/. Run `npm run sync:schemas` to refresh.',
  '',
  'type JsonObject = Record<string, unknown>;\n',
  ...entries.map(
    (entry) =>
      `/** contracts/${entry.relative} */\nexport const ${entry.identifier}: JsonObject = ${JSON.stringify(entry.json, null, 2)};\n`,
  ),
  'export const CONTRACT_SOURCE_HASHES: Readonly<Record<string, string>> = ' +
    `${JSON.stringify(manifest, null, 2)};\n`,
].join('\n');

await writeFile(join(generatedDir, 'schemas.ts'), body, 'utf8');

console.log(
  `[contracts] synced ${FILES.length} frozen contracts into packages/contracts/schemas and src/generated/schemas.ts`,
);
