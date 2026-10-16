// Offline-first photo upload.
//
// The contract: a photo is saved on this device FIRST, uploaded only through
// the authenticated API, and the word "uploaded" may only ever come from a
// server-returned URL. There is no path from local to uploaded that skips the
// server — uploadPhoto() refuses to emit that state without a URL in hand.

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export const PHOTO_TYPES = {
  'image/jpeg': true,
  'image/jpg': true,
  'image/png': true,
  'image/webp': true,
};

export function validatePhotoFile(file) {
  const type = String(file?.type || '').split(';')[0].trim().toLowerCase();
  if (!PHOTO_TYPES[type]) {
    return { ok: false, error: 'Choose a JPG, PNG or WebP image.' };
  }
  if (!file.size) {
    return { ok: false, error: 'That file is empty.' };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: 'That image is over 4 MB. Choose a smaller photo.' };
  }
  return { ok: true };
}

/**
 * Upload state machine.
 *
 * Returns {status: 'uploaded', url} only when the server handed back a URL —
 * an already-confirmed URL is reused so a retry never uploads the same photo
 * twice, and any failure (rejected, timed out, URL missing) yields
 * {status: 'failed', error} with the local file untouched.
 *
 * `upload` is injected so tests can mock the network; timeoutMs is raced
 * against it so a hung connection fails visibly instead of spinning forever.
 *
 * ponytail: the timeout only abandons the wait. A upload that lands after the
 * timeout is discarded and a retry re-sends the file (a duplicate blob in
 * storage). Acceptable at this scale; dedupe on server content-hash if it ever
 * matters.
 */
export async function uploadPhoto({ file, uploadedUrl = '', upload, timeoutMs = 15000 }) {
  if (uploadedUrl) return { status: 'uploaded', url: uploadedUrl };
  if (!file) return { status: 'failed', error: 'No photo has been chosen yet.' };
  let timer;
  try {
    const attempt = Promise.resolve().then(() => upload(file));
    const result = await Promise.race([
      attempt,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('The upload timed out. Check your connection and retry.')),
          timeoutMs
        );
      }),
    ]);
    const url = result && result.url;
    // A 200 body without a URL is not a success. Never claim uploaded here.
    if (!url) return { status: 'failed', error: 'The server did not confirm the upload.' };
    return { status: 'uploaded', url };
  } catch (err) {
    return {
      status: 'failed',
      error: (err && err.message) || 'Upload failed. Your photo is kept on this device.',
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Local retention (IndexedDB) ───────────────────────────────
//
// Retention is wrapped over a tiny async key/value contract so the browser
// gets a real IndexedDB backend while node tests inject memory — the logic
// (quota classification, load/clear contracts) is shared, only the storage
// differs. The real IndexedDB round-trip is exercised by the UI suite in a
// real browser.

export function classifyStorageError(err) {
  return err && err.name === 'QuotaExceededError' ? 'quota' : 'error';
}

/** {ok:true} | {ok:false, reason:'quota'|'error'|'unsupported'} */
export function makeRetention(kv) {
  if (!kv) {
    return {
      save: async () => ({ ok: false, reason: 'unsupported' }),
      load: async () => null,
      clear: async () => {},
    };
  }
  return {
    async save(record) {
      try {
        await kv.set(record);
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: classifyStorageError(err) };
      }
    },
    async load() {
      try {
        return (await kv.get()) || null;
      } catch {
        // A failed read must not break the page: the photo step falls back to
        // "no pending photo" rather than throwing away the form.
        return null;
      }
    },
    async clear() {
      try {
        await kv.remove();
      } catch {
        // Nothing useful to do: the local copy is unreferenced once uploaded
        // or removed, and the next save overwrites it anyway.
      }
    },
  };
}

const DB_NAME = 'hey_nomads_photo';
const STORE_NAME = 'pending';
const KEY = 'current';

function requestDone(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function openDb(factory) {
  const req = factory.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
  };
  return requestDone(req);
}

/**
 * The browser backend of makeRetention(). Returns null when IndexedDB does not
 * exist (node, very old browsers) — makeRetention then answers 'unsupported'
 * and the UI says the photo is kept for this session only.
 */
export function indexedDbKv(factory = typeof indexedDB !== 'undefined' ? indexedDB : null) {
  if (!factory) return null;
  return {
    async get() {
      const db = await openDb(factory);
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const value = await requestDone(tx.objectStore(STORE_NAME).get(KEY));
        return value || null;
      } finally {
        db.close();
      }
    },
    async set(value) {
      const db = await openDb(factory);
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, KEY);
        await txDone(tx); // rejects with the QuotaExceededError when full
      } finally {
        db.close();
      }
    },
    async remove() {
      const db = await openDb(factory);
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(KEY);
        await txDone(tx);
      } finally {
        db.close();
      }
    },
  };
}
