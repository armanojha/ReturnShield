/**
 * Phase 07A additive image-evidence repository (task P7A-DATA-01).
 *
 * Reuses the existing single-table `RepositoryStore` port and the existing
 * `gsi1`/`gsi2` indexes rather than adding new infrastructure:
 *   - primary key:      pk=`IMAGE#<image_id>`        sk=`IMAGE#<image_id>`
 *   - LISTING subject:   gsi1pk=`LISTING#<subject_id>` gsi1sk=`IMAGE#<image_id>`
 *   - RETURN_CASE subject: gsi2pk=`CASE#<subject_id>`   gsi2sk=`IMAGE#<image_id>`
 * These partition-key prefixes (`LISTING#`, `CASE#`) never collide with the
 * frozen entities already sharing gsi1/gsi2 (`SELLER#…`, `CUSTOMER#…`), so
 * no new GSI or table change is required — see `infra/data/data-indexes.ts`.
 *
 * Never stores raw image bytes; only the opaque S3 key and metadata.
 */
import { assertValidImageEntity } from '@returnshield/contracts';

import { RepositoryConflictError, RepositoryValidationError } from './errors.js';
import { GSI } from './keys.js';
import type { RepositoryStore, StoredItem } from './store.js';
import type { ImageEvidence } from './image-types.js';

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

export const imageKey = (imageId: string) => ({
  pk: `IMAGE#${imageId}`,
  sk: `IMAGE#${imageId}`,
});

function imageIndexes(value: ImageEvidence): Record<string, string> {
  if (value.subject_type === 'LISTING') {
    return { gsi1pk: `LISTING#${value.subject_id}`, gsi1sk: `IMAGE#${value.image_id}` };
  }
  return { gsi2pk: `CASE#${value.subject_id}`, gsi2sk: `IMAGE#${value.image_id}` };
}

function toStoredImage(value: ImageEvidence): StoredItem {
  try {
    assertValidImageEntity('ImageEvidence', value);
  } catch (error) {
    throw new RepositoryValidationError(
      error instanceof Error ? error.message : 'ImageEvidence validation failed',
    );
  }
  return {
    ...(value as unknown as Record<string, unknown>),
    ...imageKey(value.image_id),
    ...imageIndexes(value),
    entity_type: 'ImageEvidence',
  } as StoredItem;
}

function fromStoredImage(item: StoredItem): ImageEvidence {
  const value = Object.fromEntries(Object.entries(item).filter(([field]) => !METADATA.has(field)));
  try {
    return assertValidImageEntity<ImageEvidence>('ImageEvidence', value);
  } catch (error) {
    throw new RepositoryValidationError(
      error instanceof Error ? error.message : 'Stored ImageEvidence validation failed',
    );
  }
}

export class ImageEvidenceRepository {
  constructor(private readonly data: RepositoryStore) {}

  /** Creates the reservation record for a new upload. Fails if image_id collides. */
  async create(value: ImageEvidence): Promise<ImageEvidence> {
    if ((await this.data.put(toStoredImage(value), true)) === 'CONFLICT')
      throw new RepositoryConflictError(`ImageEvidence ${value.image_id} already exists`);
    return value;
  }

  /** Unconditional overwrite, used to transition upload/validation/analysis status. */
  async put(value: ImageEvidence): Promise<ImageEvidence> {
    await this.data.put(toStoredImage(value));
    return value;
  }

  async get(imageId: string): Promise<ImageEvidence | undefined> {
    const keys = imageKey(imageId);
    const found = await this.data.get(keys.pk, keys.sk);
    return found ? fromStoredImage(found) : undefined;
  }

  async listByListing(listingId: string): Promise<ImageEvidence[]> {
    return (
      await this.data.query({
        indexName: GSI.BY_SELLER,
        partitionName: 'gsi1pk',
        partitionValue: `LISTING#${listingId}`,
        beginsWith: 'IMAGE#',
      })
    ).map(fromStoredImage);
  }

  async listByCase(caseId: string): Promise<ImageEvidence[]> {
    return (
      await this.data.query({
        indexName: GSI.BY_CUSTOMER,
        partitionName: 'gsi2pk',
        partitionValue: `CASE#${caseId}`,
        beginsWith: 'IMAGE#',
      })
    ).map(fromStoredImage);
  }
}
