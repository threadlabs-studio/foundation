import type { ThreadlabsConfig, ThreadlabsLock } from '../domain/config.js';
import { canonicalJson, compareText, digestCanonical } from '../domain/canonicalize.js';
import type { LocalWriteEffect, OperationPlan } from '../domain/operation.js';
import { snapshotRepository } from '../adapters/filesystem.js';
import { resolveSelection } from '../modules/catalog.js';
import { renderTemplate, type TemplateContext } from '../templates/index.js';
import { fingerprintRoot, hashContent } from './fingerprint.js';
import { assertSafeTarget } from './ownership.js';

export interface PlannedOperation {
  readonly plan: OperationPlan;
  readonly digest: string;
}

function normalizedConfig(
  config: ThreadlabsConfig,
  artifactPaths: readonly string[],
): ThreadlabsConfig {
  const ownership = new Map(config.ownership.map((grant) => [grant.path, grant]));
  for (const path of artifactPaths) {
    if (!ownership.has(path)) ownership.set(path, { path, mode: 'managed' });
  }
  for (const path of ['threadlabs.config.json', '.threadlabs.lock.json']) {
    if (!ownership.has(path)) ownership.set(path, { path, mode: 'managed' });
  }
  return {
    ...config,
    ownership: [...ownership.values()].toSorted((a, b) => compareText(a.path, b.path)),
  };
}

export function createOperationPlan(
  root: string,
  config: ThreadlabsConfig,
  context: TemplateContext,
  stage = 'all',
  currentLock?: ThreadlabsLock,
): PlannedOperation {
  const snapshot = snapshotRepository(root);
  const selection = resolveSelection({ bundles: config.bundles, modules: config.modules });
  const desired = new Map<string, string>();
  for (const module of selection.modules) {
    for (const artifact of module.artifacts) {
      assertSafeTarget(root, artifact.path);
      const content = renderTemplate(artifact.template, context);
      const previous = desired.get(artifact.path);
      if (previous !== undefined && previous !== content) {
        throw new Error(`Modules disagree about managed artifact: ${artifact.path}`);
      }
      desired.set(artifact.path, content);
    }
  }

  const manifest = normalizedConfig(config, [...desired.keys()]);
  const manifestContent = canonicalJson(manifest);
  desired.set('threadlabs.config.json', manifestContent);
  const lock: ThreadlabsLock = {
    schemaVersion: '1.0',
    standardVersion: manifest.standardVersion,
    modules: Object.fromEntries(selection.modules.map((module) => [module.id, module.version])),
    artifacts: Object.fromEntries(
      [...desired.entries()].map(([path, content]) => [path, hashContent(content)]),
    ),
  };
  desired.set('.threadlabs.lock.json', canonicalJson(lock));

  const ownership = new Map(manifest.ownership.map((grant) => [grant.path, grant.mode]));
  const localEffects: LocalWriteEffect[] = [];
  for (const [path, content] of desired) {
    const existing = snapshot.files.get(path);
    if (existing === content) continue;
    const expectedPreimage = existing === undefined ? null : hashContent(existing);
    if (existing !== undefined) {
      const managed =
        ownership.get(path) === 'managed' || ownership.get(path) === 'section-managed';
      const locked = currentLock?.artifacts[path];
      if (!managed || locked !== expectedPreimage) {
        throw new Error(`Ownership is ambiguous for existing path: ${path}`);
      }
    }
    localEffects.push({
      id: `write:${path}`,
      scope: 'local',
      kind: 'write-file',
      path,
      content,
      expectedPreimage,
      postconditionDigest: hashContent(content),
    });
  }
  const rank = (path: string): number =>
    path === 'threadlabs.config.json' ? 2 : path === '.threadlabs.lock.json' ? 1 : 0;
  localEffects.sort(
    (left, right) => rank(left.path) - rank(right.path) || compareText(left.path, right.path),
  );

  const plan: OperationPlan = {
    schemaVersion: '1.0',
    standardVersion: manifest.standardVersion,
    targetRoot: '.',
    targetFingerprint: fingerprintRoot(root),
    manifestDigest: digestCanonical(manifest),
    lockDigest: currentLock === undefined ? null : digestCanonical(currentLock),
    stage,
    observations: [],
    localEffects,
    remoteEffects: [],
    postconditions: localEffects.map((effect) => `${effect.path}:${effect.postconditionDigest}`),
  };
  return { plan, digest: digestCanonical(plan) };
}
