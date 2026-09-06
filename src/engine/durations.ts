import type { VerificationLane } from '../domain/control.js';

export const LANE_BUDGET_MS: Readonly<Record<VerificationLane, number | null>> = {
  inner: 90_000,
  pr: 300_000,
  extended: 900_000,
  scheduled: null,
  release: null,
};

export function budgetFinding(lane: VerificationLane, durationMs: number): string | undefined {
  const budget = LANE_BUDGET_MS[lane];
  return budget !== null && durationMs > budget
    ? `${lane} lane took ${Math.round(durationMs / 1000)}s, above its ${Math.round(budget / 1000)}s budget; consider narrowing, deduplicating, moving a check, or documenting an exception.`
    : undefined;
}
