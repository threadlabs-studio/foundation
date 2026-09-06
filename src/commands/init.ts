import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { snapshotRepository } from '../adapters/filesystem.js';
import { validateConfig, type ThreadlabsConfig } from '../domain/config.js';
import { auditSnapshot } from '../engine/audit.js';
import { createOperationPlan } from '../engine/plan.js';
import { contextFromConfig, DEFAULT_PLAN_FILE, STANDARD_VERSION, writePlan } from './context.js';
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
    config = JSON.parse(readFileSync(resolve(options.values.config), 'utf8')) as ThreadlabsConfig;
    const issues = validateConfig(config);
    if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(' '));
  } else {
    const projectName = String(options.values.name ?? '').trim();
    if (projectName.length === 0)
      throw new Error('--name is required for noninteractive initialization.');
    const description = String(options.values.description ?? 'An open-source project.');
    const licenseHolder = String(options.values.owner ?? 'Project Contributors');
    const bundles = strings(options.values.bundle);
    const modules = strings(options.values.module);
    config = {
      schemaVersion: '1.0',
      standardVersion: STANDARD_VERSION,
      bundles: bundles.length === 0 && modules.length === 0 ? ['typescript-library'] : bundles,
      modules,
      exceptions: [],
      ownership: [],
      release: { strategy: 'single-package' },
      settings: { projectName, description, licenseHolder },
    };
  }
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
      next: `threadlabs apply ${resolve(options.root)} --plan ${DEFAULT_PLAN_FILE} --digest ${planned.digest}`,
    },
  };
}
