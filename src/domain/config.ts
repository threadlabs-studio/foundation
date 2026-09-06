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

export interface ThreadlabsConfig {
  readonly schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  readonly standardVersion: string;
  readonly bundles: readonly string[];
  readonly modules: readonly string[];
  readonly exceptions: readonly StandardException[];
  readonly ownership: readonly OwnershipGrant[];
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
  const issues: ValidationIssue[] = [];
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
      for (const key of ['controlId', 'reason', 'owner', 'scope'] as const) {
        if (typeof exception[key] !== 'string' || exception[key].trim().length === 0) {
          issues.push(
            validationIssue('required', `/exceptions/${index}/${key}`, `${key} is required.`),
          );
        }
      }
      if (typeof exception.reviewDate !== 'string' || !datePattern.test(exception.reviewDate)) {
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
  if (value.release !== undefined) {
    if (
      typeof value.release !== 'object' ||
      value.release === null ||
      Array.isArray(value.release)
    ) {
      issues.push(validationIssue('invalid_type', '/release', 'release must be an object.'));
    } else if (
      !releaseStrategies.has((value.release as { strategy?: ReleaseStrategy }).strategy!)
    ) {
      issues.push(
        validationIssue('invalid_type', '/release/strategy', 'Unknown release strategy.'),
      );
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
