/**
 * Phase 07A (task P7A-IMG-01) server-side image validation.
 *
 * Per the approved demo architecture: accept synthetic JPEG and PNG only,
 * max 5 MiB, 32–4096 px on each axis, and NEVER trust the client-supplied
 * MIME type, filename or dimensions — everything here is derived by
 * inspecting the actual object bytes after upload. No third-party image
 * library is used; only the minimal PNG IHDR / JPEG SOF parsing needed to
 * read dimensions, which keeps the Lambda bundle small and dependency-free.
 */
import type { ImageContentType, ImageRejectionReason } from '@returnshield/data';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MiB
export const MIN_DIMENSION = 32;
export const MAX_DIMENSION = 4096;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

export type ValidatedImage =
  | { ok: true; contentType: ImageContentType; width: number; height: number; sizeBytes: number }
  | { ok: false; reason: ImageRejectionReason };

/** Detects the real content type from magic bytes. Returns null if neither JPEG nor PNG. */
export function sniffContentType(bytes: Uint8Array): ImageContentType | null {
  if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return 'image/png';
  if (JPEG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return 'image/jpeg';
  return null;
}

/** Reads width/height from a PNG's IHDR chunk (bytes 16–23, big-endian). */
function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // IHDR must be the first chunk: length(4) type("IHDR",4) width(4) height(4)
  const chunkType = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (chunkType !== 'IHDR') return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Reads width/height from the first SOFn marker segment of a JPEG. */
function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2; // past the FFD8 SOI marker
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    // SOF0–SOF15 except DHT(C4), JPG(C8), DAC(CC) carry frame dimensions.
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) return null;
    if (isSof) {
      if (offset + 9 > bytes.length) return null;
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (marker === 0xda) return null; // start of scan reached before any SOF
    offset += 2 + segmentLength;
  }
  return null;
}

/**
 * Validates raw object bytes end-to-end. `declaredContentType` is the value
 * the client supplied at upload-start time and is used ONLY to detect a
 * spoofed upload (declared one type, uploaded another) — never trusted for
 * the actual `contentType`/`width`/`height` returned.
 */
export function validateImageBytes(
  bytes: Uint8Array,
  declaredContentType: ImageContentType,
): ValidatedImage {
  if (bytes.length < 1 || bytes.length > MAX_IMAGE_BYTES) return { ok: false, reason: 'OVERSIZED' };

  const actualType = sniffContentType(bytes);
  if (!actualType) return { ok: false, reason: 'UNSUPPORTED_TYPE' };
  if (actualType !== declaredContentType) return { ok: false, reason: 'SPOOFED_TYPE' };

  const dimensions =
    actualType === 'image/png' ? readPngDimensions(bytes) : readJpegDimensions(bytes);
  if (!dimensions) return { ok: false, reason: 'INVALID_DIMENSIONS' };
  const { width, height } = dimensions;
  if (
    width < MIN_DIMENSION ||
    width > MAX_DIMENSION ||
    height < MIN_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    return { ok: false, reason: 'INVALID_DIMENSIONS' };
  }

  return { ok: true, contentType: actualType, width, height, sizeBytes: bytes.length };
}
