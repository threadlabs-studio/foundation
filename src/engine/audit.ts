import { snapshotRepository, type RepositorySnapshot } from '../adapters/filesystem.js';
import { compareText, digestCanonical } from '../domain/canonicalize.js';
import type { ThreadlabsConfig, ThreadlabsLock } from '../domain/config.js';
import type { Finding } from '../domain/finding.js';
import type { ExternalEvidence, Observation } from '../domain/observation.js';
import { allBuiltInModules, getBuiltInModule, resolveSelection } from '../modules/catalog.js';
import { inferModules } from './applicability.js';
import { observationFromExternal } from './observe.js';
import { buildAuditStages, type AuditStage } from './stages.js';

export interface AuditOptions {
  readonly config?: ThreadlabsConfig;
  readonly lock?: ThreadlabsLock;
  readonly externalEvidence?: readonly ExternalEvidence[];
  readonly observedDurations?: Readonly<Record<string, number>>;
}

export interface AuditReport {
  readonly schemaVersion: '1.0';
  readonly mode: 'new' | 'existing';
  readonly selectedModules: readonly string[];
  readonly suggestedModules: readonly string[];
  readonly observations: readonly Observation[];
  readonly findings: readonly Finding[];
  readonly stages: readonly AuditStage[];
}

function finding(
  controlId: string,
  state: Finding['state'],
  title: string,
  explanation: string,
  evidence: readonly string[],
  estimatedCiSeconds = 0,
): Finding {
  return {
    controlId,
    state,
    title,
    explanation,
    evidence,
    confidenceGain: state === 'conformant' ? 'low' : 'medium',
    estimatedCiSeconds,
    migrationRisk: state === 'unknown' ? 'medium' : 'low',
    humanEffort: state === 'unknown' ? 'medium' : 'low',
  };
}

export function auditSnapshot(
  snapshot: RepositorySnapshot,
  options: AuditOptions = {},
): AuditReport {
  const mode = snapshot.files.size === 0 ? 'new' : 'existing';
  const suggestedModules = inferModules(snapshot);
  const selectedModules =
    options.config === undefined
      ? suggestedModules
      : resolveSelection({ bundles: options.config.bundles, modules: options.config.modules })
          .moduleIds;
  const modules = selectedModules.map(getBuiltInModule);
  const ownership = new Map(
    options.config?.ownership.map((grant) => [grant.path, grant.mode]) ?? [],
  );
  const managedPaths = new Set(
    [...ownership]
      .filter(([, state]) => state === 'managed' || state === 'section-managed')
      .map(([path]) => path),
  );
  const observations: Observation[] = (options.externalEvidence ?? []).map(observationFromExternal);
  const findings: Finding[] = [];

  if (snapshot.symlinks.length > 0) {
    throw new Error(
      `Managed-path symlink traversal is not supported: ${snapshot.symlinks.join(', ')}`,
    );
  }
  if (snapshot.caseCollisions.length > 0) {
    findings.push(
      finding(
        'core.path-safety',
        'unknown',
        'Case-colliding repository paths',
        'Case-colliding paths make cross-platform ownership ambiguous.',
        snapshot.caseCollisions.flat(),
      ),
    );
  }

  for (const module of modules) {
    for (const control of module.controls) {
      const duration = options.observedDurations?.[control.id];
      if (duration !== undefined && duration / 1000 > control.cost.expectedSeconds) {
        findings.push(
          finding(
            control.id,
            'suggestion',
            `${control.title} exceeds its lane budget`,
            `Observed duration exceeds the ${control.cost.expectedSeconds}s budget; retain the control and consider a slower lane or narrower scope.`,
            [`duration:${duration}ms`, `lane:${control.lane}`],
            control.cost.expectedSeconds,
          ),
        );
      }
    }
    for (const artifact of module.artifacts) {
      const content = snapshot.files.get(artifact.path);
      const controlId = module.controls[0]?.id ?? `${module.id}.baseline`;
      if (content === undefined) {
        findings.push(
          finding(
            controlId,
            'gap',
            `Missing ${artifact.path}`,
            `The ${module.title} artifact is absent.`,
            [`path:${artifact.path}`],
          ),
        );
      } else {
        const lockedDigest = options.lock?.artifacts[artifact.path];
        const actualDigest = digestCanonical(content);
        if (managedPaths.has(artifact.path) && lockedDigest === actualDigest) {
          findings.push(
            finding(
              controlId,
              'conformant',
              `${artifact.path} matches`,
              'Managed content matches the lock.',
              [`path:${artifact.path}`],
            ),
          );
        } else {
          findings.push(
            finding(
              controlId,
              'unknown',
              `Ownership is ambiguous for ${artifact.path}`,
              'Existing content has no matching managed preimage and will not be overwritten.',
              [`path:${artifact.path}`],
            ),
          );
        }
      }
    }
  }

  for (const observation of observations) {
    if (observation.state === 'unknown') {
      findings.push(
        finding(
          `${observation.source}.evidence`,
          'unknown',
          `${observation.source} evidence is unavailable`,
          'Unavailable external evidence cannot establish compliance.',
          [`source:${observation.source}`, `freshness:${observation.freshness}`],
        ),
      );
    }
  }

  const selected = new Set(selectedModules);
  for (const module of allBuiltInModules()) {
    if (!selected.has(module.id) && suggestedModules.includes(module.id)) {
      findings.push(
        finding(
          module.controls[0]?.id ?? `${module.id}.baseline`,
          'suggestion',
          `Consider ${module.title}`,
          module.description,
          [`module:${module.id}`],
        ),
      );
    }
  }

  return {
    schemaVersion: '1.0',
    mode,
    selectedModules,
    suggestedModules,
    observations: observations.toSorted((left, right) => compareText(left.id, right.id)),
    findings: findings.toSorted((left, right) =>
      compareText(`${left.controlId}:${left.title}`, `${right.controlId}:${right.title}`),
    ),
    stages: buildAuditStages(modules, new Set(snapshot.files.keys()), managedPaths),
  };
}

export function auditRepository(root: string, options: AuditOptions = {}): AuditReport {
  return auditSnapshot(snapshotRepository(root), options);
}
