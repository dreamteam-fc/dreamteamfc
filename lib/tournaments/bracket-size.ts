export function isPowerOfTwo(value: number): boolean {
  return value >= 4 && (value & (value - 1)) === 0;
}
