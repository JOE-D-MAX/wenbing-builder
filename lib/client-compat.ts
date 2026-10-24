/** Keep timeout coverage over both response headers and response-body decoding. */
export async function withRequestTimeout<T>(request: (signal: AbortSignal) => Promise<T>, milliseconds = 25000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try { return await request(controller.signal); }
  finally { clearTimeout(timer); }
}

/** UUID v4 using browser cryptography, including browsers without randomUUID. */
export function secureRandomUUID(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto?.getRandomValues !== 'function') throw new Error('当前浏览器不支持安全保存，请使用新版浏览器打开网站。');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type DecodedImage = { source: CanvasImageSource; width: number; height: number; close: () => void };

/** Older mobile WebViews can decode with Image even when ImageBitmap is absent. */
export async function decodeUploadImage(blob: Blob): Promise<DecodedImage> {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const bitmap = await globalThis.createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* Try the browser's image-element decoder before rejecting the file. */ }
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      image.src = '';
      URL.revokeObjectURL(url);
    };
    const fail = () => { close(); reject(new Error('这张图片无法读取，请换一张 JPG、PNG 或 WebP 图片。')); };
    const timer = setTimeout(fail, 25000);
    image.onload = () => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (!image.naturalWidth || !image.naturalHeight) { fail(); return; }
      resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, close });
    };
    image.onerror = fail;
    try { image.src = url; } catch { fail(); }
  });
}
