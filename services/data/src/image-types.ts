/**
 * Phase 07A additive sidecar types (task P7A-DATA-01). `ImageEvidence`
 * records reference S3 objects — opaque key, metadata, validation and
 * analysis status — and NEVER raw image bytes. They attach to exactly one
 * subject (`LISTING` or `RETURN_CASE`) and never mutate that subject's
 * frozen Phase 00 fields (`risk_score`, `decision`, `priority`,
 * `contributions`, etc.).
 */
import type { JsonObject, SchemaVersion } from './types.js';

export type ImageSubjectType = 'LISTING' | 'RETURN_CASE';
export type ImageContentType = 'image/jpeg' | 'image/png';
export type ImageUploadStatus = 'PENDING' | 'UPLOADED' | 'VALIDATED' | 'REJECTED' | 'EXPIRED';
export type ImageRejectionReason =
  | 'UNSUPPORTED_TYPE'
  | 'SPOOFED_TYPE'
  | 'OVERSIZED'
  | 'INVALID_DIMENSIONS'
  | 'UPLOAD_EXPIRED'
  | 'OBJECT_MISSING'
  | 'SUBJECT_MISMATCH';
export type ImageAnalysisStatus = 'NOT_REQUESTED' | 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE';

export interface ImageEvidence {
  schema_version: SchemaVersion;
  image_id: string;
  subject_type: ImageSubjectType;
  subject_id: string;
  s3_key: string;
  content_type: ImageContentType;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  upload_status: ImageUploadStatus;
  rejection_reason: ImageRejectionReason | null;
  analysis_status: ImageAnalysisStatus;
  analysis: JsonObject | null;
  model_id: string | null;
  upload_expires_at: string;
  correlation_id: string;
  created_at: string;
  updated_at: string;
}
