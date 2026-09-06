import { validationIssue, type ValidationIssue } from './errors.js';

export const CONFIG_SCHEMA_VERSION = '1.0' as const;
export const OWNERSHIP_STATES = [
  'managed',
  'section-managed',
  'local',
  'unmanaged',
  'ambiguous',
] as const;

export type OwnershipState = (typeof OWNERSHIP_STATES)[number];
export type ReleaseStrategy =
  | 'single-package'
  | 'fixed-monorepo'
  | 'independent-monorepo'
  | 'prerelease-channel'
  | 'exceptional-multi-artifact';

export interface StandardException {
  readonly controlId: string;
  readonly reason: string;
  readonly owner: string;
  readonly scope: string;
  readonly reviewDate: string;
}

export interface OwnershipGrant {
  readonly path: string;
  readonly mode: OwnershipState;
  readonly anchors?: readonly [string, string];
}

export interface FreshnessHold {
  readonly name: string;
  readonly reason: string;
  readonly owner: string;
  readonly reviewDate: string;
}

export interface ThreadlabsConfig {
  readonly schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  readonly standardVersion: string;
  readonly bundles: readonly string[];
  readonly modules: readonly string[];
  readonly exceptions: readonly StandardException[];
  readonly ownership: readonly OwnershipGrant[];
  readonly freshness?: { readonly holds: readonly FreshnessHold[] };
  readonly release?: { readonly strategy: ReleaseStrategy };
  readonly settings?: Readonly<Record<string, unknown>>;
}

export interface ThreadlabsLock {
  readonly schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  readonly standardVersion: string;
  readonly modules: Readonly<Record<string, string>>;
  readonly artifacts: Readonly<Record<string, string>>;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const identifierPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const releaseStrategies = new Set<ReleaseStrategy>([
  'single-package',
  'fixed-monorepo',
  'independent-monorepo',
  'prerelease-channel',
  'exceptional-multi-artifact',
]);

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function duplicateIssues(values: readonly unknown[], path: string): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const [index, value] of values.entries()) {
    if (typeof value !== 'string') {
      issues.push(validationIssue('invalid_type', `${path}/${index}`, 'Expected a string ID.'));
    } else if (seen.has(value)) {
      issues.push(validationIssue('duplicate_id', `${path}/${index}`, `Duplicate ID: ${value}`));
    } else {
      seen.add(value);
    }
  }
  return issues;
}

function unknownKeyIssues(
  value: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
  path: string,
): ValidationIssue[] {
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) =>
      validationIssue(
        'unknown_property',
        `${path}/${key}`.replace('//', '/'),
        `Unknown property: ${key}`,
      ),
    );
}

export function validateManagedPath(path: string): ValidationIssue[] {
  if (path.length === 0) {
    return [validationIssue('invalid_path', '/path', 'Path must not be empty.')];
  }
  if (path.includes('\\') || path.includes('\0') || path.startsWith('/')) {
    return [
      validationIssue('invalid_path', '/path', 'Path must be a portable repository-relative path.'),
    ];
  }
  const segments = path.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.' || segment === '')) {
    return [validationIssue('invalid_path', '/path', 'Path contains an unsafe segment.')];
  }
  if (segments.some((segment) => segment.toLowerCase() === '.git')) {
    return [validationIssue('invalid_path', '/path', 'Git metadata is never a managed target.')];
  }
  return [];
}

export function validateConfig(input: unknown): ValidationIssue[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return [validationIssue('invalid_type', '/', 'Manifest must be an object.')];
  }
  const value = input as Record<string, unknown>;
  const issues: ValidationIssue[] = unknownKeyIssues(
    value,
    new Set([
      'schemaVersion',
      'standardVersion',
      'bundles',
      'modules',
      'exceptions',
      'ownership',
      'freshness',
      'release',
      'settings',
    ]),
    '',
  );
  if (typeof value.schemaVersion !== 'string' || !value.schemaVersion.startsWith('1.')) {
    issues.push(
      validationIssue('unsupported_schema', '/schemaVersion', 'Only schema major 1 is supported.'),
    );
  }
  if (typeof value.standardVersion !== 'string' || value.standardVersion.length === 0) {
    issues.push(validationIssue('required', '/standardVersion', 'A standard version is required.'));
  }
  for (const key of ['bundles', 'modules'] as const) {
    const list = value[key];
    if (!Array.isArray(list)) {
      issues.push(validationIssue('invalid_type', `/${key}`, `${key} must be an array.`));
    } else {
      issues.push(...duplicateIssues(list, `/${key}`));
      list.forEach((item, index) => {
        if (typeof item === 'string' && !identifierPattern.test(item)) {
          issues.push(validationIssue('invalid_type', `/${key}/${index}`, `Invalid ID: ${item}`));
        }
      });
    }
  }
  if (!Array.isArray(value.exceptions)) {
    issues.push(validationIssue('invalid_type', '/exceptions', 'exceptions must be an array.'));
  } else {
    value.exceptions.forEach((item, index) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        issues.push(
          validationIssue('invalid_type', `/exceptions/${index}`, 'Exception must be an object.'),
        );
        return;
      }
      const exception = item as Record<string, unknown>;
      issues.push(
        ...unknownKeyIssues(
          exception,
          new Set(['controlId', 'reason', 'owner', 'scope', 'reviewDate']),
          `/exceptions/${index}`,
        ),
      );
      for (const key of ['controlId', 'reason', 'owner', 'scope'] as const) {
        if (typeof exception[key] !== 'string' || exception[key].trim().length === 0) {
          issues.push(
            validationIssue('required', `/exceptions/${index}/${key}`, `${key} is required.`),
          );
        }
      }
      if (!isCalendarDate(exception.reviewDate)) {
        issues.push(
          validationIssue(
            'invalid_review_date',
            `/exceptions/${index}/reviewDate`,
            'reviewDate must use YYYY-MM-DD.',
          ),
        );
      }
    });
  }
  if (!Array.isArray(value.ownership)) {
    issues.push(validationIssue('invalid_type', '/ownership', 'ownership must be an array.'));
  } else {
    const ownedPaths = new Set<string>();
    value.ownership.forEach((item, index) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        issues.push(
          validationIssue('invalid_type', `/ownership/${index}`, 'Ownership must be an object.'),
        );
        return;
      }
      const grant = item as Record<string, unknown>;
      issues.push(
        ...unknownKeyIssues(grant, new Set(['path', 'mode', 'anchors']), `/ownership/${index}`),
      );
      if (typeof grant.path !== 'string') {
        issues.push(validationIssue('required', `/ownership/${index}/path`, 'path is required.'));
      } else {
        issues.push(
          ...validateManagedPath(grant.path).map((issue) => ({
            ...issue,
            path: `/ownership/${index}/path`,
          })),
        );
        if (ownedPaths.has(grant.path)) {
          issues.push(
            validationIssue(
              'duplicate_id',
              `/ownership/${index}/path`,
              `Duplicate ownership path: ${grant.path}`,
            ),
          );
        }
        ownedPaths.add(grant.path);
      }
      if (!OWNERSHIP_STATES.includes(grant.mode as OwnershipState)) {
        issues.push(
          validationIssue('invalid_type', `/ownership/${index}/mode`, 'Unknown ownership mode.'),
        );
      }
      if (grant.mode === 'section-managed') {
        if (
          !Array.isArray(grant.anchors) ||
          grant.anchors.length !== 2 ||
          grant.anchors.some((anchor) => typeof anchor !== 'string' || anchor.trim().length < 3)
        ) {
          issues.push(
            validationIssue(
              'invalid_anchor',
              `/ownership/${index}/anchors`,
              'Two stable anchors are required.',
            ),
          );
        }
      }
    });
  }
  if (value.freshness !== undefined) {
    if (
      typeof value.freshness !== 'object' ||
      value.freshness === null ||
      Array.isArray(value.freshness)
    ) {
      issues.push(validationIssue('invalid_type', '/freshness', 'freshness must be an object.'));
    } else {
      const freshness = value.freshness as Record<string, unknown>;
      issues.push(...unknownKeyIssues(freshness, new Set(['holds']), '/freshness'));
      const holds = freshness.holds;
      if (!Array.isArray(holds)) {
        issues.push(
          validationIssue('invalid_type', '/freshness/holds', 'freshness.holds must be an array.'),
        );
      } else {
        const names = new Set<string>();
        holds.forEach((item, index) => {
          if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            issues.push(
              validationIssue(
                'invalid_type',
                `/freshness/holds/${index}`,
                'Freshness hold must be an object.',
              ),
            );
            return;
          }
          const hold = item as Record<string, unknown>;
          issues.push(
            ...unknownKeyIssues(
              hold,
              new Set(['name', 'reason', 'owner', 'reviewDate']),
              `/freshness/holds/${index}`,
            ),
          );
          for (const key of ['name', 'reason', 'owner'] as const) {
            if (typeof hold[key] !== 'string' || hold[key].trim().length === 0) {
              issues.push(
                validationIssue(
                  'required',
                  `/freshness/holds/${index}/${key}`,
                  `${key} is required.`,
                ),
              );
            }
          }
          if (typeof hold.name === 'string') {
            if (names.has(hold.name)) {
              issues.push(
                validationIssue(
                  'duplicate_id',
                  `/freshness/holds/${index}/name`,
                  `Duplicate freshness hold: ${hold.name}`,
                ),
              );
            }
            names.add(hold.name);
          }
          if (!isCalendarDate(hold.reviewDate)) {
            issues.push(
              validationIssue(
                'invalid_review_date',
                `/freshness/holds/${index}/reviewDate`,
                'reviewDate must use YYYY-MM-DD.',
              ),
            );
          }
        });
      }
    }
  }
  if (value.release !== undefined) {
    if (
      typeof value.release !== 'object' ||
      value.release === null ||
      Array.isArray(value.release)
    ) {
      issues.push(validationIssue('invalid_type', '/release', 'release must be an object.'));
    } else {
      const release = value.release as Record<string, unknown>;
      issues.push(...unknownKeyIssues(release, new Set(['strategy']), '/release'));
      if (!releaseStrategies.has(release.strategy as ReleaseStrategy)) {
        issues.push(
          validationIssue('invalid_type', '/release/strategy', 'Unknown release strategy.'),
        );
      }
    }
  }
  if (
    value.settings !== undefined &&
    (typeof value.settings !== 'object' || value.settings === null || Array.isArray(value.settings))
  ) {
    issues.push(validationIssue('invalid_type', '/settings', 'settings must be an object.'));
  }
  return issues;
}
