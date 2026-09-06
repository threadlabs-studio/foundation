import type { VerificationCheckResult, VerificationLane } from './control.js';
import type { ExternalEvidence } from './observation.js';

export interface VerificationEvidence {
  readonly schemaVersion: '1.0';
  readonly standardVersion: string;
  readonly revision: string;
  readonly dirtyFingerprint: string;
  readonly lane: VerificationLane;
  readonly state: 'passed' | 'partial' | 'failed' | 'canceled' | 'unknown';
  readonly observedAt: string;
  readonly checks: readonly VerificationCheckResult[];
  readonly externalEvidence: readonly ExternalEvidence[];
  readonly skippedControls: readonly string[];
  readonly remainingHumanJudgment: readonly string[];
}
