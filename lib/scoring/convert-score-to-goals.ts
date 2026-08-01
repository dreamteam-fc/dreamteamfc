export function convertScoreToGoals(score: number): number {
  if (!Number.isFinite(score)) {
    throw new Error("score must be a finite number.");
  }

  if (score <= 25) {
    return 0;
  }

  return Math.floor((score - 25) / 2);
}
