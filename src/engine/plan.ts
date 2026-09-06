import type { ThreadlabsConfig, ThreadlabsLock } from '../domain/config.js';
import { canonicalJson, compareText, digestCanonical } from '../domain/canonicalize.js';
import type { LocalWriteEffect, OperationPlan } from '../domain/operation.js';
import { snapshotRepository } from '../adapters/filesystem.js';
import { resolveSelection } from '../modules/catalog.js';
import { renderTemplate, type TemplateContext } from '../templates/index.js';
import { fingerprintRoot, hashContent } from './fingerprint.js';
import { assertSafeTarget } from './ownership.js';
import { releaseArtifacts } from './release.js';
import { ownedContentDigest, renderManagedSection } from './sections.js';

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
    ownership.set(path, { path, mode: 'managed' });
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
  if (snapshot.caseCollisions.length > 0) {
    throw new Error(
      `Case-collision ambiguity must be resolved before planning: ${snapshot.caseCollisions
        .flat()
        .join(', ')}`,
    );
  }
  const selection = resolveSelection({ bundles: config.bundles, modules: config.modules });
  const desired = new Map<string, string>();
  const artifactStages = new Map<string, string>();
  for (const module of selection.modules) {
    for (const artifact of module.artifacts) {
      assertSafeTarget(root, artifact.path);
      const content = renderTemplate(artifact.template, context);
      const previous = desired.get(artifact.path);
      if (previous !== undefined && previous !== content) {
        throw new Error(`Modules disagree about managed artifact: ${artifact.path}`);
      }
      desired.set(artifact.path, content);
      const owningStage = module.stages.find((candidate) =>
        candidate.artifactPaths.includes(artifact.path),
      );
      if (owningStage !== undefined) artifactStages.set(artifact.path, owningStage.id);
    }
  }
  if (selection.moduleIds.includes('npm-publish')) {
    for (const artifact of releaseArtifacts(config.release?.strategy ?? 'single-package')) {
      assertSafeTarget(root, artifact.path);
      const content = renderTemplate(artifact.template, context);
      const previous = desired.get(artifact.path);
      if (previous !== undefined && previous !== content) {
        throw new Error(`Modules disagree about managed artifact: ${artifact.path}`);
      }
      desired.set(artifact.path, content);
      artifactStages.set(artifact.path, 'npm-publish.install');
    }
  }

  const allArtifactPaths = [...desired.keys()];
  const manifest = normalizedConfig(config, allArtifactPaths);
  const ownership = new Map(manifest.ownership.map((grant) => [grant.path, grant]));
  const isPartialStage = stage !== 'all' && stage !== 'upgrade';
  for (const path of desired.keys()) {
    const grant = ownership.get(path);
    const mode = grant?.mode;
    if (mode === 'local' || mode === 'unmanaged') desired.delete(path);
    if (mode === 'ambiguous') throw new Error(`Ownership is ambiguous for artifact: ${path}`);
    if (mode === 'section-managed') {
      if (grant?.anchors === undefined) throw new Error(`Section anchors are required: ${path}`);
      desired.set(
        path,
        renderManagedSection(snapshot.files.get(path), desired.get(path)!, grant.anchors),
      );
    }
  }
  const validManagedPaths = new Set(desired.keys());
  if (isPartialStage) {
    const knownStage = selection.modules.some((module) =>
      module.stages.some((candidate) => candidate.id === stage),
    );
    if (!knownStage) throw new Error(`Unknown or inapplicable adoption stage: ${stage}`);
    for (const path of desired.keys()) {
      if (artifactStages.get(path) !== stage) desired.delete(path);
    }
  }
  const manifestContent = canonicalJson(manifest);
  const planManifestDigest = digestCanonical(manifest);
  desired.set('threadlabs.config.json', manifestContent);
  const artifactDigests = new Map<string, string>();
  if (isPartialStage) {
    for (const [path, digest] of Object.entries(currentLock?.artifacts ?? {})) {
      if (validManagedPaths.has(path)) artifactDigests.set(path, digest);
    }
  }
  for (const [path, content] of desired) {
    artifactDigests.set(path, ownedContentDigest(content, ownership.get(path)));
  }
  const lock: ThreadlabsLock = {
    schemaVersion: '1.0',
    standardVersion: manifest.standardVersion,
    modules: Object.fromEntries(selection.modules.map((module) => [module.id, module.version])),
    artifacts: Object.fromEntries(artifactDigests),
  };
  desired.set('.threadlabs.lock.json', canonicalJson(lock));

  const localEffects: LocalWriteEffect[] = [];
  for (const [path, content] of desired) {
    const existing = snapshot.files.get(path);
    if (existing === content) continue;
    const expectedPreimage = existing === undefined ? null : hashContent(existing);
    if (existing !== undefined) {
      const managed =
        ownership.get(path)?.mode === 'managed' || ownership.get(path)?.mode === 'section-managed';
      const locked =
        path === '.threadlabs.lock.json' && currentLock !== undefined
          ? hashContent(canonicalJson(currentLock))
          : currentLock?.artifacts[path];
      const actualOwnedDigest = ownedContentDigest(existing, ownership.get(path));
      let authoredManifestMatches = false;
      if (path === 'threadlabs.config.json') {
        try {
          authoredManifestMatches = digestCanonical(JSON.parse(existing)) === planManifestDigest;
        } catch {
          authoredManifestMatches = false;
        }
      }
      if (!managed || (!authoredManifestMatches && locked !== actualOwnedDigest)) {
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
    manifestDigest: planManifestDigest,
    lockDigest: currentLock === undefined ? null : digestCanonical(currentLock),
    stage,
    observations: [],
    localEffects,
    remoteEffects: [],
    postconditions: localEffects.map((effect) => `${effect.path}:${effect.postconditionDigest}`),
  };
  return { plan, digest: digestCanonical(plan) };
}
