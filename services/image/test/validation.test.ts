import { describe, expect, it } from 'vitest';

import { validateImageBytes } from '../src/validation.js';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

describe('validateImageBytes', () => {
  it('derives trusted PNG metadata from bytes', () => {
    expect(validateImageBytes(png(640, 480), 'image/png')).toEqual({
      ok: true,
      contentType: 'image/png',
      width: 640,
      height: 480,
      sizeBytes: 24,
    });
  });
  it('rejects spoofed types and invalid dimensions', () => {
    expect(validateImageBytes(png(640, 480), 'image/jpeg')).toEqual({
      ok: false,
      reason: 'SPOOFED_TYPE',
    });
    expect(validateImageBytes(png(12, 12), 'image/png')).toEqual({
      ok: false,
      reason: 'INVALID_DIMENSIONS',
    });
  });
  it('rejects malformed JPEG segments without looping', () => {
    expect(
      validateImageBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), 'image/jpeg'),
    ).toEqual({ ok: false, reason: 'INVALID_DIMENSIONS' });
  });
});
