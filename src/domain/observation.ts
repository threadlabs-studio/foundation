export type ObservationState =
  'present' | 'absent' | 'matching' | 'drifted' | 'unsupported' | 'unknown';

export type ExternalEvidenceState =
  'available' | 'unavailable' | 'forbidden' | 'rate-limited' | 'stale' | 'invalid';

export interface Observation {
  readonly id: string;
  readonly source: string;
  readonly observedAt: string;
  readonly state: ObservationState;
  readonly freshness: 'fresh' | 'stale' | 'not-applicable';
  readonly value?: unknown;
  readonly details?: string;
}

export interface ExternalEvidence {
  readonly source: string;
  readonly observedAt: string;
  readonly state: ExternalEvidenceState;
  readonly normalized?: unknown;
  readonly details?: string;
}
