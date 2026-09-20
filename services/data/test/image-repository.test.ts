import { describe, expect, it } from 'vitest';

import { createRepositories, type ImageEvidence } from '../src/index.js';
import { InMemoryRepositoryStore } from './support/in-memory-store.js';

const pending: ImageEvidence = {
  schema_version: '1.0.0',
  image_id: 'IMG-test',
  subject_type: 'LISTING',
  subject_id: 'LISTING-clean',
  s3_key: 'evidence/00000000-0000-4000-8000-000000000000',
  content_type: 'image/png',
  size_bytes: null,
  width: null,
  height: null,
  upload_status: 'PENDING',
  rejection_reason: null,
  analysis_status: 'NOT_REQUESTED',
  analysis: null,
  model_id: null,
  upload_expires_at: '2026-09-20T12:05:00Z',
  correlation_id: 'correlation-1',
  created_at: '2026-09-20T12:00:00Z',
  updated_at: '2026-09-20T12:00:00Z',
};

describe('ImageEvidenceRepository', () => {
  it('stores nullable pending metadata and lists by subject', async () => {
    const repositories = createRepositories(new InMemoryRepositoryStore());
    await repositories.images.create(pending);
    expect(await repositories.images.get(pending.image_id)).toEqual(pending);
    expect(await repositories.images.listByListing(pending.subject_id)).toEqual([pending]);
  });

  it('uses the case index for return evidence', async () => {
    const repositories = createRepositories(new InMemoryRepositoryStore());
    const item = {
      ...pending,
      image_id: 'IMG-case',
      subject_type: 'RETURN_CASE' as const,
      subject_id: 'CASE-high',
    };
    await repositories.images.create(item);
    expect(await repositories.images.listByCase('CASE-high')).toEqual([item]);
  });
});
