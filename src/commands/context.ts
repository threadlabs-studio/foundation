import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { atomicWriteFile } from '../adapters/atomic-filesystem.js';
import { canonicalJson } from '../domain/canonicalize.js';
import { validateConfig, type ThreadlabsConfig, type ThreadlabsLock } from '../domain/config.js';
import type { OperationPlan } from '../domain/operation.js';
import { resolveSelection } from '../modules/catalog.js';
import type { TemplateContext } from '../templates/index.js';

export const STANDARD_VERSION = '1.0.0';
export const DEFAULT_PLAN_FILE = '.threadlabs/plans/latest.json';

function loadJson<T>(root: string, path: string): T | undefined {
  const absolute = resolve(root, path);
  return existsSync(absolute) ? (JSON.parse(readFileSync(absolute, 'utf8')) as T) : undefined;
}

export function loadConfig(root: string): ThreadlabsConfig | undefined {
  const config = loadJson<ThreadlabsConfig>(root, 'threadlabs.config.json');
  if (config === undefined) return undefined;
  const issues = validateConfig(config);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(' '));
  return config;
}

export function loadLock(root: string): ThreadlabsLock | undefined {
  return loadJson<ThreadlabsLock>(root, '.threadlabs.lock.json');
}

export function contextFromConfig(config: ThreadlabsConfig): TemplateContext {
  const settings = config.settings ?? {};
  return {
    projectName: typeof settings.projectName === 'string' ? settings.projectName : 'my-project',
    description:
      typeof settings.description === 'string' ? settings.description : 'An open-source project.',
    licenseHolder:
      typeof settings.licenseHolder === 'string' ? settings.licenseHolder : 'Project Contributors',
    licenseYear:
      typeof settings.licenseYear === 'number' && Number.isInteger(settings.licenseYear)
        ? settings.licenseYear
        : new Date().getUTCFullYear(),
  };
}

export function summarizeSelection(config: ThreadlabsConfig): {
  readonly modules: readonly {
    readonly id: string;
    readonly title: string;
    readonly dependencies: readonly string[];
    readonly controls: readonly {
      readonly id: string;
      readonly lane: string;
      readonly expectedSeconds: number;
      readonly applicability: string;
    }[];
  }[];
  readonly estimatedSecondsByLane: Readonly<Record<string, number>>;
} {
  const selection = resolveSelection({ bundles: config.bundles, modules: config.modules });
  const estimatedSecondsByLane: Record<string, number> = {};
  const modules = selection.modules.map((module) => ({
    id: module.id,
    title: module.title,
    dependencies: module.dependencies,
    controls: module.controls.map((control) => {
      estimatedSecondsByLane[control.lane] =
        (estimatedSecondsByLane[control.lane] ?? 0) + control.cost.expectedSeconds;
      return {
        id: control.id,
        lane: control.lane,
        expectedSeconds: control.cost.expectedSeconds,
        applicability: control.applicability,
      };
    }),
  }));
  return { modules, estimatedSecondsByLane };
}

export interface PersistedPlan {
  readonly schemaVersion: '1.0';
  readonly digest: string;
  readonly plan: OperationPlan;
}

export function writePlan(root: string, path: string, value: PersistedPlan): void {
  atomicWriteFile(root, path, canonicalJson(value));
}

export function readPlan(root: string, path: string): PersistedPlan {
  const plan = loadJson<PersistedPlan>(root, path);
  if (plan === undefined) throw new Error(`Plan file not found: ${path}`);
  return plan;
}
