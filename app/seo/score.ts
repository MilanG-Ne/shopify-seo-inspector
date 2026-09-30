import { PENALTY } from "./rules";

/**
 * Each resource starts at 100 and loses points per issue. The store score is
 * the mean across resources, so it doesn't sink just because a catalog is big.
 */
export function resourceScore(fails: number, warns: number): number {
  return Math.max(0, 100 - fails * PENALTY.fail - warns * PENALTY.warn);
}

export function storeScore(resourceScores: number[]): number {
  if (resourceScores.length === 0) return 100;
  const total = resourceScores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / resourceScores.length);
}

export type ScoreBand = "good" | "fair" | "poor";

export function scoreBand(score: number): ScoreBand {
  if (score >= 90) return "good";
  if (score >= 70) return "fair";
  return "poor";
}
