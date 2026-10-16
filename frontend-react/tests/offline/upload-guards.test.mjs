// MOCKED / OFFLINE unit tests — no network, no database, no storage service.
// Covers api/upload-guards.mjs, the pure verdict layer behind POST /api/upload.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUpload,
  MAX_UPLOAD_BYTES,
  ALLOWED_IMAGE_TYPES,
} from '../../api/upload-guards.mjs';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0x11)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0x22),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(32, 0x33),
]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');

test('accepts a genuine JPEG declared as image/jpeg', () => {
  const v = validateUpload({ contentType: 'image/jpeg', buffer: JPEG });
  assert.equal(v.ok, true);
  assert.equal(v.contentType, 'image/jpeg');
  assert.equal(v.ext, 'jpg');
});

test('accepts a genuine PNG and WEBP', () => {
  assert.equal(validateUpload({ contentType: 'image/png', buffer: PNG }).ok, true);
  assert.equal(validateUpload({ contentType: 'image/webp', buffer: WEBP }).ok, true);
});

test('normalizes the legacy image/jpg alias to image/jpeg', () => {
  const v = validateUpload({ contentType: 'image/jpg', buffer: JPEG });
  assert.equal(v.ok, true);
  assert.equal(v.contentType, 'image/jpeg');
});

test('ignores content-type parameters (charset etc.)', () => {
  const v = validateUpload({ contentType: 'image/png; charset=binary', buffer: PNG });
  assert.equal(v.ok, true);
  assert.equal(v.contentType, 'image/png');
});

test('rejects a non-image content type with 415', () => {
  const v = validateUpload({ contentType: 'text/html', buffer: HTML });
  assert.equal(v.ok, false);
  assert.equal(v.status, 415);
});

test('rejects an empty body with 400', () => {
  const v = validateUpload({ contentType: 'image/jpeg', buffer: Buffer.alloc(0) });
  assert.equal(v.ok, false);
  assert.equal(v.status, 400);
});

test('rejects an oversized body with 413', () => {
  const big = Buffer.concat([JPEG, Buffer.alloc(MAX_UPLOAD_BYTES)]); // > cap
  const v = validateUpload({ contentType: 'image/jpeg', buffer: big });
  assert.equal(v.ok, false);
  assert.equal(v.status, 413);
});

test('rejects bytes that do not match the declared type with 400', () => {
  // Declared image, but the file is really HTML — the magic-byte mismatch.
  const v = validateUpload({ contentType: 'image/png', buffer: HTML });
  assert.equal(v.ok, false);
  assert.equal(v.status, 400);
});

test('a JPEG wearing a PNG header is rejected', () => {
  const v = validateUpload({ contentType: 'image/png', buffer: JPEG });
  assert.equal(v.ok, false);
  assert.equal(v.status, 400);
});

test('positive control: every rejection carries a distinct status and message', () => {
  const cases = [
    validateUpload({ contentType: 'text/html', buffer: HTML }),                      // 415
    validateUpload({ contentType: 'image/jpeg', buffer: Buffer.alloc(0) }),          // 400
    validateUpload({ contentType: 'image/jpeg', buffer: Buffer.concat([JPEG, Buffer.alloc(MAX_UPLOAD_BYTES)]) }), // 413
    validateUpload({ contentType: 'image/png', buffer: HTML }),                      // 400 magic
  ];
  for (const c of cases) {
    assert.equal(c.ok, false);
    assert.ok([400, 413, 415].includes(c.status), `unexpected status ${c.status}`);
    assert.ok(c.error && c.error.length > 0);
    // None of them may fall through to the generic 500 string the storage
    // path keeps — this is the "Upload failed" control.
    assert.notEqual(c.error, 'Upload failed');
  }
  const messages = new Set(cases.map(c => c.error));
  assert.equal(messages.size, cases.length, 'each failure must say something different');
});

test('positive control: the allowlist only ever holds image types', () => {
  for (const key of Object.keys(ALLOWED_IMAGE_TYPES)) {
    assert.ok(key.startsWith('image/'), `${key} is not an image type`);
  }
});
