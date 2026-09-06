export type FindingState =
  'gap' | 'suggestion' | 'exception' | 'unsupported' | 'unknown' | 'conformant';
export type MigrationRisk = 'low' | 'medium' | 'high';

export interface Finding {
  readonly controlId: string;
  readonly state: FindingState;
  readonly title: string;
  readonly explanation: string;
  readonly evidence: readonly string[];
  readonly confidenceGain: 'low' | 'medium' | 'high';
  readonly estimatedCiSeconds: number;
  readonly migrationRisk: MigrationRisk;
  readonly humanEffort: 'low' | 'medium' | 'high';
}
