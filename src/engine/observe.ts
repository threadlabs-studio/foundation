import type { ExternalEvidence, Observation } from '../domain/observation.js';

export function observationFromExternal(evidence: ExternalEvidence): Observation {
  return {
    id: `external.${evidence.source}`,
    source: evidence.source,
    observedAt: evidence.observedAt,
    state: evidence.state === 'available' ? 'present' : 'unknown',
    freshness: evidence.state === 'stale' ? 'stale' : 'fresh',
    ...(evidence.normalized === undefined ? {} : { value: evidence.normalized }),
    ...(evidence.details === undefined ? {} : { details: evidence.details }),
  };
}
