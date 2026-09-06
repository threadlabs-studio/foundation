import type { ExternalEvidence } from '../domain/observation.js';

export interface NodeLine {
  readonly major: number;
  readonly status: 'active-lts' | 'maintenance-lts' | 'current' | 'eol';
}

export function nodeLifecycleEvidence(
  lines: readonly NodeLine[] | undefined,
  observedAt = new Date().toISOString(),
): ExternalEvidence {
  return lines === undefined
    ? { source: 'node-lifecycle', observedAt, state: 'unavailable' }
    : { source: 'node-lifecycle', observedAt, state: 'available', normalized: lines };
}
