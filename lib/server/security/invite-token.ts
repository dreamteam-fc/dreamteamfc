import { createHash, randomBytes } from "node:crypto";

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token.normalize("NFKC")).digest("hex");
}
