import { randomUUID } from 'node:crypto';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  assertValidImage,
  errorEnvelope,
  isValidCorrelationId,
  resolveCorrelationId,
} from '@returnshield/contracts';
import {
  createRepositories,
  DynamoDbRepositoryStore,
  type ImageContentType,
  type ImageEvidence,
  type Repositories,
} from '@returnshield/data';
import {
  BedrockImageAnalysisClient,
  imageAnalysisModelId,
  type ImageAnalysisModelClient,
  validateImageAnalysisOutput,
} from '@returnshield/image-analysis';
import {
  buildReservationInput,
  completeReservation,
  DynamoDbIdempotencyStore,
  failReservation,
  imageCompleteIdempotencyKey,
  imageUploadIdempotencyKey,
  reserveOrReplay,
  type IdempotencyStoreClient,
} from '@returnshield/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { logImageFailure } from './logger.js';
import { ImageEvidenceBucket, newObjectKey } from './s3.js';
import { validateImageBytes } from './validation.js';

interface UploadInput {
  schema_version: '1.0.0';
  subject_type: 'LISTING' | 'RETURN_CASE';
  subject_id: string;
  content_type: ImageContentType;
}
interface CompleteInput {
  schema_version: '1.0.0';
}
interface BucketPort {
  presignUpload(key: string, contentType: string): Promise<{ url: string; expiresAt: string }>;
  presignDownload(key: string): Promise<{ url: string; expiresAt: string }>;
  readObject(key: string): Promise<Uint8Array | null>;
}
interface Dependencies {
  repositories: Repositories;
  idempotency: IdempotencyStoreClient;
  bucket: BucketPort;
  model: ImageAnalysisModelClient;
  modelId: string;
}

function header(event: APIGatewayProxyEvent, name: string): string | undefined {
  const found = Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === name);
  return typeof found?.[1] === 'string' ? found[1] : undefined;
}
function response(statusCode: number, body: unknown, correlationId: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(body),
  };
}
function failure(
  statusCode: number,
  correlationId: string,
  code: Parameters<typeof errorEnvelope>[1],
  message: string,
  retryable = false,
) {
  return response(
    statusCode,
    errorEnvelope(correlationId, code, message, { retryable }),
    correlationId,
  );
}
function bodyOf(event: APIGatewayProxyEvent): unknown {
  if (!event.body) return undefined;
  return JSON.parse(
    event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body,
  );
}
function envelope(correlationId: string, data: unknown) {
  return { schema_version: '1.0.0', correlation_id: correlationId, data };
}
async function subjectText(
  input: UploadInput,
  repositories: Repositories,
): Promise<string | undefined> {
  if (input.subject_type === 'LISTING') {
    const listing = await repositories.listings.get(input.subject_id);
    return listing
      ? `${listing.title}\n${listing.description}\nCategory: ${listing.category}`
      : undefined;
  }
  const value = await repositories.cases.get(input.subject_id);
  return value
    ? `Return reason: ${value.reason}\n${value.evidence.map((item) => item.text).join('\n')}`
    : undefined;
}
function requireIdempotency(event: APIGatewayProxyEvent): string | undefined {
  const key = header(event, 'idempotency-key');
  return key && isValidCorrelationId(key) ? key : undefined;
}

export function createImageHandler(deps: Dependencies) {
  async function startUpload(event: APIGatewayProxyEvent, correlationId: string) {
    const key = requireIdempotency(event);
    if (!key)
      return failure(400, correlationId, 'VALIDATION_ERROR', 'Idempotency-Key is required.');
    let input: UploadInput;
    try {
      input = assertValidImage<UploadInput>('ImageUploadRequest', bodyOf(event));
    } catch {
      return failure(400, correlationId, 'VALIDATION_ERROR', 'Image upload request is invalid.');
    }
    if (!(await subjectText(input, deps.repositories)))
      return failure(404, correlationId, 'NOT_FOUND', 'The image subject was not found.');
    const reservationInput = buildReservationInput(
      'IMAGE_UPLOAD',
      imageUploadIdempotencyKey(key),
      input,
    );
    const reservation = await reserveOrReplay(deps.idempotency, reservationInput);
    if (reservation.kind === 'CONFLICT')
      return failure(
        409,
        correlationId,
        'IDEMPOTENCY_CONFLICT',
        'The idempotency key was already used with a different request.',
      );
    if (reservation.kind === 'IN_PROGRESS')
      return failure(
        409,
        correlationId,
        'REQUEST_IN_PROGRESS',
        'An identical upload request is in progress.',
        true,
      );
    if (reservation.kind === 'COMPLETED')
      return response(200, reservation.record.result, correlationId);
    try {
      const imageId = `IMG-${randomUUID()}`;
      const objectKey = newObjectKey();
      const signed = await deps.bucket.presignUpload(objectKey, input.content_type);
      const now = new Date().toISOString();
      const image: ImageEvidence = {
        schema_version: '1.0.0',
        image_id: imageId,
        subject_type: input.subject_type,
        subject_id: input.subject_id,
        s3_key: objectKey,
        content_type: input.content_type,
        size_bytes: null,
        width: null,
        height: null,
        upload_status: 'PENDING',
        rejection_reason: null,
        analysis_status: 'NOT_REQUESTED',
        analysis: null,
        model_id: null,
        upload_expires_at: signed.expiresAt,
        correlation_id: correlationId,
        created_at: now,
        updated_at: now,
      };
      await deps.repositories.images.create(image);
      const result = assertValidImage(
        'ImageUploadResponse',
        envelope(correlationId, {
          image_id: imageId,
          upload_url: signed.url,
          upload_expires_at: signed.expiresAt,
          required_content_type: input.content_type,
        }),
      );
      await completeReservation(deps.idempotency, reservationInput, result, imageId);
      return response(201, result, correlationId);
    } catch (error) {
      await failReservation(deps.idempotency, reservationInput);
      logImageFailure({
        event: 'image.upload.start',
        correlation_id: correlationId,
        stage: 'persistence',
        error_kind: error instanceof Error ? error.name : 'UnknownError',
      });
      return failure(
        500,
        correlationId,
        'INTERNAL_ERROR',
        'The image upload could not be started.',
        true,
      );
    }
  }

  async function completeUpload(
    event: APIGatewayProxyEvent,
    correlationId: string,
    imageId: string,
  ) {
    const key = requireIdempotency(event);
    if (!key)
      return failure(400, correlationId, 'VALIDATION_ERROR', 'Idempotency-Key is required.');
    let input: CompleteInput;
    try {
      input = assertValidImage<CompleteInput>('ImageCompleteRequest', bodyOf(event));
    } catch {
      return failure(
        400,
        correlationId,
        'VALIDATION_ERROR',
        'Image completion request is invalid.',
      );
    }
    const payload = { ...input, image_id: imageId };
    const reservationInput = buildReservationInput(
      'IMAGE_COMPLETE',
      imageCompleteIdempotencyKey(imageId, key),
      payload,
      imageId,
    );
    const reservation = await reserveOrReplay(deps.idempotency, reservationInput);
    if (reservation.kind === 'CONFLICT')
      return failure(
        409,
        correlationId,
        'IDEMPOTENCY_CONFLICT',
        'The idempotency key was already used with a different request.',
      );
    if (reservation.kind === 'IN_PROGRESS')
      return failure(
        409,
        correlationId,
        'REQUEST_IN_PROGRESS',
        'Image completion is already in progress.',
        true,
      );
    if (reservation.kind === 'COMPLETED')
      return response(200, reservation.record.result, correlationId);
    try {
      let image = await deps.repositories.images.get(imageId);
      if (!image) {
        await failReservation(deps.idempotency, reservationInput);
        return failure(404, correlationId, 'NOT_FOUND', 'Image evidence was not found.');
      }
      if (image.upload_status !== 'PENDING') {
        const result = assertValidImage('ImageEvidenceResponse', envelope(correlationId, image));
        await completeReservation(deps.idempotency, reservationInput, result, imageId);
        return response(200, result, correlationId);
      }
      if (Date.now() > Date.parse(image.upload_expires_at)) {
        image = {
          ...image,
          upload_status: 'EXPIRED',
          rejection_reason: 'UPLOAD_EXPIRED',
          updated_at: new Date().toISOString(),
        };
      } else {
        const bytes = await deps.bucket.readObject(image.s3_key);
        if (!bytes)
          image = {
            ...image,
            upload_status: 'REJECTED',
            rejection_reason: 'OBJECT_MISSING',
            updated_at: new Date().toISOString(),
          };
        else {
          const validated = validateImageBytes(bytes, image.content_type);
          if (!validated.ok)
            image = {
              ...image,
              upload_status: 'REJECTED',
              rejection_reason: validated.reason,
              updated_at: new Date().toISOString(),
            };
          else {
            image = {
              ...image,
              content_type: validated.contentType,
              size_bytes: validated.sizeBytes,
              width: validated.width,
              height: validated.height,
              upload_status: 'VALIDATED',
              rejection_reason: null,
              analysis_status: 'PENDING',
              updated_at: new Date().toISOString(),
            };
            const text = await subjectText(
              {
                schema_version: '1.0.0',
                subject_type: image.subject_type,
                subject_id: image.subject_id,
                content_type: image.content_type,
              },
              deps.repositories,
            );
            if (!text)
              image = {
                ...image,
                upload_status: 'REJECTED',
                rejection_reason: 'SUBJECT_MISMATCH',
                analysis_status: 'NOT_REQUESTED',
                updated_at: new Date().toISOString(),
              };
            else {
              try {
                const raw = await deps.model.analyze(
                  {
                    image_id: imageId,
                    subject_type: image.subject_type,
                    subject_id: image.subject_id,
                    subject_text: text,
                  },
                  bytes,
                  image.content_type === 'image/png' ? 'png' : 'jpeg',
                );
                const analysis = validateImageAnalysisOutput(raw, imageId);
                image = {
                  ...image,
                  analysis_status: 'AVAILABLE',
                  analysis: analysis as unknown as ImageEvidence['analysis'],
                  model_id: deps.modelId,
                  updated_at: new Date().toISOString(),
                };
              } catch (error) {
                logImageFailure({
                  event: 'image.analysis',
                  correlation_id: correlationId,
                  stage: 'bedrock_validation',
                  error_kind: error instanceof Error ? error.name : 'UnknownError',
                });
                image = {
                  ...image,
                  analysis_status: 'UNAVAILABLE',
                  analysis: null,
                  model_id: deps.modelId,
                  updated_at: new Date().toISOString(),
                };
              }
            }
          }
        }
      }
      await deps.repositories.images.put(image);
      const result = assertValidImage('ImageEvidenceResponse', envelope(correlationId, image));
      await completeReservation(deps.idempotency, reservationInput, result, imageId);
      return response(200, result, correlationId);
    } catch (error) {
      await failReservation(deps.idempotency, reservationInput);
      logImageFailure({
        event: 'image.upload.complete',
        correlation_id: correlationId,
        stage: 'processing',
        error_kind: error instanceof Error ? error.name : 'UnknownError',
      });
      return failure(500, correlationId, 'INTERNAL_ERROR', 'Image completion failed.', true);
    }
  }

  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const correlationId = resolveCorrelationId(header(event, 'x-correlation-id'));
    const resource = event.resource ?? '';
    if (event.httpMethod === 'POST' && resource.endsWith('/images/uploads'))
      return startUpload(event, correlationId);
    if (event.httpMethod === 'POST' && resource.endsWith('/images/{image_id}/complete'))
      return completeUpload(event, correlationId, event.pathParameters?.image_id ?? '');
    if (event.httpMethod === 'GET' && resource.endsWith('/images/{image_id}/download')) {
      const image = await deps.repositories.images.get(event.pathParameters?.image_id ?? '');
      if (!image) return failure(404, correlationId, 'NOT_FOUND', 'Image evidence was not found.');
      if (image.upload_status !== 'VALIDATED')
        return failure(
          409,
          correlationId,
          'INVALID_STATE',
          'Image evidence is not available for download.',
        );
      const signed = await deps.bucket.presignDownload(image.s3_key);
      return response(
        200,
        assertValidImage(
          'ImageDownloadResponse',
          envelope(correlationId, { download_url: signed.url, expires_at: signed.expiresAt }),
        ),
        correlationId,
      );
    }
    if (event.httpMethod === 'GET' && resource.endsWith('/images/{image_id}')) {
      const image = await deps.repositories.images.get(event.pathParameters?.image_id ?? '');
      return image
        ? response(
            200,
            assertValidImage('ImageEvidenceResponse', envelope(correlationId, image)),
            correlationId,
          )
        : failure(404, correlationId, 'NOT_FOUND', 'Image evidence was not found.');
    }
    let items: ImageEvidence[] | undefined;
    if (event.httpMethod === 'GET' && resource.endsWith('/listings/{listing_id}/images'))
      items = await deps.repositories.images.listByListing(event.pathParameters?.listing_id ?? '');
    if (event.httpMethod === 'GET' && resource.endsWith('/cases/{case_id}/images'))
      items = await deps.repositories.images.listByCase(event.pathParameters?.case_id ?? '');
    if (items)
      return response(
        200,
        assertValidImage(
          'ImageListResponse',
          envelope(correlationId, { items, next_cursor: null }),
        ),
        correlationId,
      );
    return failure(404, correlationId, 'NOT_FOUND', 'Route was not found.');
  };
}

const tableName = process.env.RETURNSHIELD_TABLE_NAME;
const bucketName = process.env.RETURNSHIELD_IMAGE_BUCKET_NAME;
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockImageAnalysisClient();
const configured =
  tableName && bucketName
    ? createImageHandler({
        repositories: createRepositories(new DynamoDbRepositoryStore(tableName, documentClient)),
        idempotency: new DynamoDbIdempotencyStore({ tableName, documentClient }),
        bucket: new ImageEvidenceBucket(bucketName),
        model: bedrock,
        modelId: imageAnalysisModelId(bedrock),
      })
    : undefined;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (configured) return configured(event);
  const correlationId = resolveCorrelationId(header(event, 'x-correlation-id'));
  return failure(500, correlationId, 'INTERNAL_ERROR', 'Image service is not configured.', true);
}
export default handler;
