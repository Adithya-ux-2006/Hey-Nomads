// MOCKED / OFFLINE unit tests — no network, no real storage.
// Covers src/lib/photoUpload.js: file validation, the upload state machine,
// and local retention (quota handling) over injected storage doubles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PHOTO_BYTES,
  validatePhotoFile,
  uploadPhoto,
  classifyStorageError,
  makeRetention,
  indexedDbKv,
} from '../../src/lib/photoUpload.js';

const file = (type, size) => ({ name: 'x', type, size });

// ── validatePhotoFile ─────────────────────────────────────────

test('accepts a normal JPG under the cap', () => {
  assert.deepEqual(validatePhotoFile(file('image/jpeg', 1024)), { ok: true });
});

test('accepts the image/jpg alias and a typed name', () => {
  assert.equal(validatePhotoFile(file('image/jpg', 2048)).ok, true);
  assert.equal(validatePhotoFile(file('image/png', 2048)).ok, true);
  assert.equal(validatePhotoFile(file('image/webp', 2048)).ok, true);
});

test('rejects non-image types', () => {
  const v = validatePhotoFile(file('text/html', 10));
  assert.equal(v.ok, false);
  assert.match(v.error, /JPG, PNG or WebP/);
});

test('rejects an empty file and an oversized one', () => {
  assert.equal(validatePhotoFile(file('image/jpeg', 0)).ok, false);
  const big = validatePhotoFile(file('image/jpeg', MAX_PHOTO_BYTES + 1));
  assert.equal(big.ok, false);
  assert.match(big.error, /4 MB/);
});

// ── uploadPhoto state machine ─────────────────────────────────

test('reuses a confirmed URL without calling upload again (no duplicate upload)', async () => {
  let calls = 0;
  const r = await uploadPhoto({
    file: file('image/jpeg', 10),
    uploadedUrl: 'https://blob/x.jpg',
    upload: async () => { calls += 1; throw new Error('must not be called'); },
  });
  assert.deepEqual(r, { status: 'uploaded', url: 'https://blob/x.jpg' });
  assert.equal(calls, 0);
});

test('server-confirmed URL comes back as uploaded', async () => {
  const r = await uploadPhoto({
    file: file('image/jpeg', 10),
    upload: async () => ({ url: 'https://blob/new.jpg' }),
  });
  assert.deepEqual(r, { status: 'uploaded', url: 'https://blob/new.jpg' });
});

test('a 200 body without a URL is NOT uploaded (no fake success)', async () => {
  const r = await uploadPhoto({
    file: file('image/jpeg', 10),
    upload: async () => ({ ok: true }),
  });
  assert.equal(r.status, 'failed');
  assert.match(r.error, /did not confirm/);
});

test('a rejected upload fails with the server message and keeps the file', async () => {
  const r = await uploadPhoto({
    file: file('image/jpeg', 10),
    upload: async () => { throw new Error('413: too large'); },
  });
  assert.equal(r.status, 'failed');
  assert.match(r.error, /413/);
});

test('a hung connection fails visibly at the timeout', async () => {
  const r = await uploadPhoto({
    file: file('image/jpeg', 10),
    upload: () => new Promise(() => {}), // never settles
    timeoutMs: 20,
  });
  assert.equal(r.status, 'failed');
  assert.match(r.error, /timed out/);
});

test('no file selected fails rather than pretending to upload', async () => {
  const r = await uploadPhoto({ file: null, upload: async () => ({ url: 'x' }) });
  assert.equal(r.status, 'failed');
});

test('positive control: across every outcome, uploaded only with a URL', async () => {
  const outcomes = await Promise.all([
    uploadPhoto({ file: file('image/jpeg', 1), upload: async () => ({ url: 'u1' }) }),
    uploadPhoto({ file: file('image/jpeg', 1), upload: async () => ({ ok: 1 }) }),
    uploadPhoto({ file: file('image/jpeg', 1), upload: async () => { throw new Error('e'); } }),
    uploadPhoto({ file: file('image/jpeg', 1), uploadedUrl: 'u0', upload: async () => ({ ok: 1 }) }),
    uploadPhoto({ file: null, upload: async () => ({ url: 'u2' }) }),
  ]);
  for (const o of outcomes) {
    if (o.status === 'uploaded') assert.ok(o.url, 'uploaded without a url');
    else assert.equal(o.status, 'failed');
  }
  assert.equal(outcomes.filter(o => o.status === 'uploaded').length, 2);
});

// ── retention over injected storage ───────────────────────────

const memoryKv = () => {
  let store = null;
  return {
    set: async v => { store = v; },
    get: async () => store,
    remove: async () => { store = null; },
  };
};

const quotaKv = () => ({
  set: async () => {
    throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
  },
  get: async () => null,
  remove: async () => {},
});

test('retention round-trips a pending photo', async () => {
  const r = makeRetention(memoryKv());
  assert.deepEqual(await r.save({ blob: {}, name: 'a.jpg' }), { ok: true });
  const loaded = await r.load();
  assert.equal(loaded.name, 'a.jpg');
  await r.clear();
  assert.equal(await r.load(), null);
});

test('quota exhaustion reports reason quota, not a generic error', async () => {
  const r = makeRetention(quotaKv());
  assert.deepEqual(await r.save({ blob: {} }), { ok: false, reason: 'quota' });
  assert.equal(classifyStorageError(new Error('x')), 'error');
  assert.equal(
    classifyStorageError(Object.assign(new Error('x'), { name: 'QuotaExceededError' })),
    'quota'
  );
});

test('missing storage is unsupported, and load falls back to null', async () => {
  const r = makeRetention(null);
  assert.deepEqual(await r.save({}), { ok: false, reason: 'unsupported' });
  assert.equal(await r.load(), null);
  await r.clear(); // must not throw
});

test('a failing read or clear never throws into the page', async () => {
  const r = makeRetention({
    get: async () => { throw new Error('blocked'); },
    set: async () => { throw new Error('blocked'); },
    remove: async () => { throw new Error('blocked'); },
  });
  assert.equal(await r.load(), null);
  assert.equal((await r.save({})).ok, false);
  await r.clear();
});

test('positive control: no storage backend without IndexedDB', () => {
  // In node there is no indexedDB, so the browser backend must decline
  // rather than fabricate a store.
  assert.equal(indexedDbKv(undefined), null);
  assert.equal(indexedDbKv(null), null);
});
