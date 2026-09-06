export type VerificationLane = 'inner' | 'pr' | 'extended' | 'scheduled' | 'release';
export type Determinism = 'deterministic' | 'environmental' | 'human';
export type HumanEffort = 'low' | 'medium' | 'high';

export interface ControlCost {
  readonly expectedSeconds: number;
  readonly humanEffort: HumanEffort;
}

export interface ControlDefinition {
  readonly id: string;
  readonly title: string;
  readonly failureClass: string;
  readonly applicability: string;
  readonly lane: VerificationLane;
  readonly determinism: Determinism;
  readonly cost: ControlCost;
  readonly cheaperAlternatives: readonly string[];
  readonly retirementCondition: string;
}

export type VerificationResultState = 'passed' | 'failed' | 'skipped' | 'canceled' | 'unknown';

export interface VerificationCheckResult {
  readonly controlId: string;
  readonly command?: readonly string[];
  readonly state: VerificationResultState;
  readonly durationMs?: number;
  readonly details?: string;
}
