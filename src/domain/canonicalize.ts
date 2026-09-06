import { createHash } from 'node:crypto';

const unorderedCollectionKeys = new Set([
  'artifacts',
  'bundles',
  'capabilities',
  'conflicts',
  'controlIds',
  'controls',
  'dependencies',
  'exceptions',
  'externalEvidence',
  'modules',
  'observations',
  'ownership',
  'postconditions',
  'skippedControls',
]);

function normalize(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalize(item));
    if (parentKey !== undefined && unorderedCollectionKeys.has(parentKey)) {
      return normalized.toSorted((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right), 'en'),
      );
    }
    return normalized;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .toSorted(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, item]) => [key, normalize(item, key)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(normalize(value))}\n`;
}

export function digestCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
