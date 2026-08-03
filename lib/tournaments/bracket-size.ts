export const ALLOWED_BRACKET_SIZES = [4, 8, 16, 32, 64] as const;

export type BracketSize = (typeof ALLOWED_BRACKET_SIZES)[number];

/** Testo UI / errori: "4, 8, 16, 32 o 64" */
export const ALLOWED_BRACKET_SIZES_LABEL = "4, 8, 16, 32 o 64";

export function isAllowedBracketSize(value: number): value is BracketSize {
  return (ALLOWED_BRACKET_SIZES as readonly number[]).includes(value);
}

/** Alias storico: valida le dimensioni tabellone ammesse (non ogni potenza di 2). */
export function isPowerOfTwo(value: number): boolean {
  return isAllowedBracketSize(value);
}
