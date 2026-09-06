import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { snapshotRepository } from '../adapters/filesystem.js';
import { validateConfig, type ThreadlabsConfig } from '../domain/config.js';
import { auditSnapshot } from '../engine/audit.js';
import { createOperationPlan } from '../engine/plan.js';
import { resolveSelection } from '../modules/catalog.js';
import {
  contextFromConfig,
  DEFAULT_PLAN_FILE,
  STANDARD_VERSION,
  summarizeSelection,
  writePlan,
} from './context.js';
import type { CommandOptions, CommandResult } from './types.js';

function strings(value: string | boolean | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' ? [value] : [];
}

export function initCommand(options: CommandOptions): CommandResult {
  mkdirSync(options.root, { recursive: true });
  const snapshot = snapshotRepository(options.root);
  if (snapshot.files.size > 0) {
    const report = auditSnapshot(snapshot);
    return {
      command: 'init',
      status: 'findings',
      exitClass: 'findings',
      summary: 'The target is nonempty and unmanaged; review the read-only audit before adoption.',
      data: report,
    };
  }
  let config: ThreadlabsConfig;
  if (typeof options.values.config === 'string') {
    if (
      ['name', 'description', 'owner', 'bundle', 'module'].some(
        (key) => options.values[key] !== undefined,
      )
    ) {
      throw new Error('--config cannot be combined with manifest selection flags.');
    }
    config = JSON.parse(readFileSync(resolve(options.values.config), 'utf8')) as ThreadlabsConfig;
  } else {
    const projectName = String(options.values.name ?? '').trim();
    if (projectName.length === 0)
      throw new Error('--name is required for noninteractive initialization.');
    const description = String(options.values.description ?? 'An open-source project.');
    const licenseHolder = String(options.values.owner ?? 'Project Contributors');
    const requestedBundles = strings(options.values.bundle);
    const modules = strings(options.values.module);
    const bundles =
      requestedBundles.length === 0 && modules.length === 0
        ? ['typescript-library']
        : requestedBundles;
    const usesTypescript = resolveSelection({ bundles, modules }).moduleIds.includes(
      'typescript-node',
    );
    config = {
      schemaVersion: '1.0',
      standardVersion: STANDARD_VERSION,
      bundles,
      modules,
      exceptions: [],
      ownership: [],
      ...(usesTypescript
        ? {
            freshness: {
              holds: [
                {
                  name: '@types/node',
                  reason: 'Type declarations intentionally target the minimum supported Node line.',
                  owner: licenseHolder,
                  reviewDate: `${new Date().getUTCFullYear() + 1}-01-31`,
                },
              ],
            },
          }
        : {}),
      release: { strategy: 'single-package' },
      settings: {
        projectName,
        description,
        licenseHolder,
        licenseYear: new Date().getUTCFullYear(),
      },
    };
  }
  const issues = validateConfig(config);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(' '));
  const context = contextFromConfig(config);
  const planned = createOperationPlan(options.root, config, context);
  writePlan(options.root, DEFAULT_PLAN_FILE, {
    schemaVersion: '1.0',
    digest: planned.digest,
    plan: planned.plan,
  });
  return {
    command: 'init',
    status: 'success',
    exitClass: 'success',
    summary: 'Initialization plan created; review it and apply using its exact digest.',
    data: {
      digest: planned.digest,
      planFile: DEFAULT_PLAN_FILE,
      effects: planned.plan.localEffects.map(({ id, path }) => ({ id, path })),
      selection: summarizeSelection(config),
      next: {
        workingDirectory: 'target repository',
        executable: 'threadlabs',
        arguments: ['apply', '.', '--plan', DEFAULT_PLAN_FILE, '--digest', planned.digest],
      },
    },
  };
}
