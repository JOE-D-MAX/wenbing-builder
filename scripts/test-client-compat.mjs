import assert from 'node:assert/strict';
import { withRequestTimeout, secureRandomUUID, decodeUploadImage } from '../lib/client-compat.ts';

// Simulate mobile WebViews with getRandomValues but without randomUUID.
const originals = new Map();
function override(target, key, value) {
  let keys = originals.get(target);
  if (!keys) { keys = new Map(); originals.set(target, keys); }
  if (!keys.has(key)) keys.set(key, Object.getOwnPropertyDescriptor(target, key));
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
}
try {
  override(globalThis, 'crypto', { getRandomValues(bytes) { bytes.set(Array.from({ length: 16 }, (_, i) => i)); return bytes; } });
  assert.equal(secureRandomUUID(), '00010203-0405-4607-8809-0a0b0c0d0e0f');
  override(globalThis, 'crypto', undefined);
  assert.throws(() => secureRandomUUID(), /不支持安全保存/);
  override(globalThis, 'crypto', { randomUUID() { assert.equal(this, globalThis.crypto); return 'native-uuid'; } });
  assert.equal(secureRandomUUID(), 'native-uuid');

  override(AbortSignal, 'timeout', undefined);
  let completedSignal;
  assert.equal(await withRequestTimeout(async signal => { completedSignal = signal; return 'done'; }, 5), 'done');
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(completedSignal.aborted, false, 'a completed request must clear its timer');
  await assert.rejects(withRequestTimeout(signal => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted while decoding response')), { once: true });
  }), 5), /aborted while decoding/);
  let failedSignal;
  await assert.rejects(withRequestTimeout(async signal => { failedSignal = signal; throw new Error('network failure'); }, 5), /network failure/);
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(failedSignal.aborted, false, 'a failed request must also clear its timer');

  const created = [], revoked = [];
  let imageFails = false;
  class MobileImage {
    naturalWidth = 1600;
    naturalHeight = 900;
    onload = null;
    onerror = null;
    set src(value) { if (value) queueMicrotask(() => imageFails ? this.onerror?.() : this.onload?.()); }
  }
  override(globalThis, 'Image', MobileImage);
  override(URL, 'createObjectURL', () => { const url = 'blob:upload-' + created.length; created.push(url); return url; });
  override(URL, 'revokeObjectURL', url => revoked.push(url));
  override(globalThis, 'createImageBitmap', undefined);
  const blob = new Blob(['image bytes'], { type: 'image/jpeg' });
  const fallback = await decodeUploadImage(blob);
  assert.equal(fallback.width, 1600);
  assert.equal(fallback.height, 900);
  assert(fallback.source instanceof MobileImage);
  assert.deepEqual(revoked, [], 'keep the object URL until drawing is done');
  fallback.close(); fallback.close();
  assert.deepEqual(revoked, [created[0]], 'close is idempotent and releases the URL');

  imageFails = true;
  await assert.rejects(decodeUploadImage(blob), /无法读取/);
  assert.deepEqual(revoked, created, 'decoding errors must release object URLs');
  imageFails = false;
  override(globalThis, 'createImageBitmap', async () => { throw new Error('unsupported decoder'); });
  const rejectedBitmap = await decodeUploadImage(blob);
  rejectedBitmap.close();
  assert.deepEqual(revoked, created, 'Image fallback also handles unavailable bitmap codecs');

  let bitmapClosed = false;
  const bitmap = { width: 600, height: 400, close() { bitmapClosed = true; } };
  override(globalThis, 'createImageBitmap', async () => bitmap);
  const native = await decodeUploadImage(blob);
  assert.equal(native.source, bitmap);
  native.close();
  assert.equal(bitmapClosed, true);
  assert.equal(created.length, 3, 'native decoding does not allocate an object URL');
} finally {
  for (const [target, keys] of originals) for (const [key, descriptor] of keys) {
    if (descriptor) Object.defineProperty(target, key, descriptor); else delete target[key];
  }
}
console.log('PASS: cryptographic UUID fallback; timeout abort and cleanup without AbortSignal.timeout; image decoding fallback and URL release on success/failure; native decoders preserved.');
