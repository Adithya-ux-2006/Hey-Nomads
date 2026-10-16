// Pure guards for POST /api/upload. No express, no storage, no network, no
// database — the offline gate suite asserts every rejection branch by calling
// validateUpload() directly, and the route maps each verdict onto its status.
//
// Order matters: the declared content type decides eligibility, the streaming
// size cap in the route stops an oversized body before it is buffered whole,
// and the magic bytes keep a file's real content honest against its header.

// Vercel caps request bodies at ~4.5MB; the client validates the same limit so
// a user is never shown a failure the server was always going to give.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Bytes every accepted format must start with. */
function sniffImageType(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  ) return 'image/jpeg';
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'image/png';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'image/webp';
  return null;
}

function normalizeType(contentType) {
  return String(contentType || '').split(';')[0].trim().toLowerCase();
}

/**
 * @returns {{ok: true, contentType: string, ext: string}
 *          |{ok: false, status: number, error: string}}
 */
export function validateUpload({ contentType, buffer }) {
  const declared = normalizeType(contentType);
  const ext = ALLOWED_IMAGE_TYPES[declared];
  if (!ext) {
    return {
      ok: false,
      status: 415,
      error: 'Unsupported image type. Use a JPG, PNG or WebP.',
    };
  }
  if (!buffer || buffer.length === 0) {
    return { ok: false, status: 400, error: 'The upload body was empty.' };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      error: 'Image is too large. The maximum size is 4 MB.',
    };
  }
  // A .jpg that is really HTML (or anything else) is refused before storage:
  // what the bytes say must match what the header claimed.
  const sniffed = sniffImageType(buffer);
  if (sniffed === null || sniffed !== declared) {
    // image/jpg is a legacy alias of image/jpeg; accept the alias when the
    // bytes are genuinely JPEG.
    if (!(declared === 'image/jpg' && sniffed === 'image/jpeg')) {
      return {
        ok: false,
        status: 400,
        error: 'The file content does not match its declared image type.',
      };
    }
  }
  return { ok: true, contentType: declared === 'image/jpg' ? 'image/jpeg' : declared, ext };
}
