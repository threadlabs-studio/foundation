import { compareText } from '../domain/canonicalize.js';
import type { VerificationCheckResult } from '../domain/control.js';

export function normalizeCiChecks(
  checks: readonly VerificationCheckResult[],
): readonly VerificationCheckResult[] {
  return [...checks].toSorted((left, right) => compareText(left.controlId, right.controlId));
}
