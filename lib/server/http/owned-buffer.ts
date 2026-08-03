/**
 * Helpers that always copy bytes into memory backed by a normal ArrayBuffer.
 *
 * `File.arrayBuffer()` / some Node Buffer views can be SharedArrayBuffer-backed.
 * Undici (Node 22+ fetch, used by @supabase/supabase-js) rejects those bodies with:
 * "ArrayBuffer: SharedArrayBuffer is not allowed."
 *
 * `Buffer.from(arrayBuffer)` shares memory and keeps the problem; copy via Uint8Array.
 */

export function toOwnedBuffer(
  source: ArrayBuffer | ArrayBufferView | Buffer
): Buffer {
  if (Buffer.isBuffer(source) || ArrayBuffer.isView(source)) {
    return Buffer.from(source);
  }

  return Buffer.from(new Uint8Array(source));
}

export async function fileToOwnedBuffer(file: File): Promise<Buffer> {
  return toOwnedBuffer(await file.arrayBuffer());
}

/** Fresh Uint8Array for fetch / storage upload bodies. */
export function toOwnedUint8Array(source: Buffer | Uint8Array): Uint8Array {
  return new Uint8Array(source);
}
