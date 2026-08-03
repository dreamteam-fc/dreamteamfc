/**
 * Helpers that always copy bytes into memory backed by a normal ArrayBuffer.
 *
 * `File.arrayBuffer()` / some Node Buffer views can be SharedArrayBuffer-backed.
 * Undici (Node 22+ fetch, used by @supabase/supabase-js) rejects those bodies with:
 * "ArrayBuffer: SharedArrayBuffer is not allowed."
 *
 * Important:
 * - `Buffer.from(arrayBuffer)` shares memory when given an ArrayBuffer/SAB.
 * - `new Uint8Array(sab)` is only a view over the SAB.
 * - Always allocate a fresh Uint8Array and `.set()` into it before fetch/upload.
 */

function asUint8View(
  source: ArrayBuffer | ArrayBufferView | Buffer
): Uint8Array {
  if (Buffer.isBuffer(source) || ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }

  return new Uint8Array(source);
}

/**
 * Fresh Uint8Array backed by a normal ArrayBuffer (never SharedArrayBuffer).
 * Return type is `Uint8Array<ArrayBuffer>` so callers can pass it to Blob/fetch
 * under TS 5.7+ / Node 22 DOM lib (BlobPart/BodyInit reject ArrayBufferLike).
 */
export function toOwnedUint8Array(
  source: ArrayBuffer | ArrayBufferView | Buffer
): Uint8Array<ArrayBuffer> {
  const view = asUint8View(source);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy;
}

/** Fresh Buffer whose underlying ArrayBuffer is never SharedArrayBuffer. */
export function toOwnedBuffer(
  source: ArrayBuffer | ArrayBufferView | Buffer
): Buffer {
  return Buffer.from(toOwnedUint8Array(source));
}

export async function fileToOwnedBuffer(file: Blob): Promise<Buffer> {
  return toOwnedBuffer(await file.arrayBuffer());
}

/** Blob body for storage upload — avoids passing TypedArray/Buffer to undici. */
export function toOwnedBlob(
  source: ArrayBuffer | ArrayBufferView | Buffer,
  contentType: string
): Blob {
  // Pass a sliced ArrayBuffer (not the TypedArray) so BlobPart is unambiguously ArrayBuffer.
  const u8 = toOwnedUint8Array(source);
  const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  return new Blob([ab], { type: contentType });
}
