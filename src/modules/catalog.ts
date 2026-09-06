import type { ModuleDefinition } from '../domain/module.js';
import { compareText } from '../domain/canonicalize.js';
import { agentsModule } from './agents.js';
import { browserModule } from './browser.js';
import { BUILT_IN_BUNDLES } from './bundles.js';
import { coreModule } from './core.js';
import { crossPlatformModule } from './cross-platform.js';
import { docsModule } from './docs.js';
import { freshnessModule } from './freshness.js';
import { generatedArtifactsModule } from './generated-artifacts.js';
import { githubModule } from './github.js';
import { longRunningModule } from './long-running.js';
import { npmPublishModule } from './npm-publish.js';
import { performanceModule } from './performance.js';
import { publicApiModule } from './public-api.js';
import { typescriptNodeModule } from './typescript-node.js';

export { TYPESCRIPT_LIBRARY_BUNDLE } from './bundles.js';

const modules = [
  agentsModule,
  browserModule,
  coreModule,
  crossPlatformModule,
  docsModule,
  freshnessModule,
  generatedArtifactsModule,
  githubModule,
  longRunningModule,
  npmPublishModule,
  performanceModule,
  publicApiModule,
  typescriptNodeModule,
] as const;

const catalog = new Map<string, ModuleDefinition>(modules.map((module) => [module.id, module]));
const bundles = new Map(BUILT_IN_BUNDLES.map((bundle) => [bundle.id, bundle]));

export const BUILT_IN_MODULE_IDS = [...catalog.keys()].toSorted(compareText);

export function getBuiltInModule(id: string): ModuleDefinition {
  const module = catalog.get(id);
  if (module === undefined) throw new Error(`Unknown module: ${id}`);
  return module;
}

export function allBuiltInModules(): readonly ModuleDefinition[] {
  return BUILT_IN_MODULE_IDS.map(getBuiltInModule);
}

export interface ModuleSelection {
  readonly bundles: readonly string[];
  readonly modules: readonly string[];
}

export interface ResolvedSelection {
  readonly moduleIds: readonly string[];
  readonly modules: readonly ModuleDefinition[];
}

export function resolveSelection(selection: ModuleSelection): ResolvedSelection {
  const requested = new Set(selection.modules);
  for (const bundleId of selection.bundles) {
    const bundle = bundles.get(bundleId);
    if (bundle === undefined) throw new Error(`Unknown bundle: ${bundleId}`);
    bundle.modules.forEach((id) => requested.add(id));
  }
  const resolved = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string): void => {
    if (resolved.has(id)) return;
    if (visiting.has(id)) throw new Error(`Circular module dependency at ${id}`);
    visiting.add(id);
    const module = getBuiltInModule(id);
    module.dependencies.toSorted(compareText).forEach(visit);
    visiting.delete(id);
    resolved.add(id);
  };
  [...requested].toSorted(compareText).forEach(visit);
  const moduleIds = [...resolved];
  for (const id of moduleIds) {
    const module = getBuiltInModule(id);
    const conflict = module.conflicts.find((candidate) => resolved.has(candidate));
    if (conflict !== undefined) throw new Error(`Conflicting modules: ${id} and ${conflict}`);
  }
  return { moduleIds, modules: moduleIds.map(getBuiltInModule) };
}
