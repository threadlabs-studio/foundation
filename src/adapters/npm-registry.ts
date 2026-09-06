import type { ExternalEvidence } from '../domain/observation.js';

export function npmRegistryEvidence(
  packageName: string,
  latest: string | undefined,
  observedAt = new Date().toISOString(),
): ExternalEvidence {
  return latest === undefined
    ? { source: `npm:${packageName}`, observedAt, state: 'unavailable' }
    : { source: `npm:${packageName}`, observedAt, state: 'available', normalized: { latest } };
}
