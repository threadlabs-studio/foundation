import { createOperationPlan } from '../engine/plan.js';
import {
  contextFromConfig,
  DEFAULT_PLAN_FILE,
  loadConfig,
  loadLock,
  writePlan,
} from './context.js';
import type { CommandOptions, CommandResult } from './types.js';

export function planCommand(options: CommandOptions): CommandResult {
  const config = loadConfig(options.root);
  if (config === undefined)
    throw new Error('threadlabs.config.json is required; run init or audit first.');
  const planned = createOperationPlan(
    options.root,
    config,
    contextFromConfig(config),
    String(options.values.stage ?? 'all'),
    loadLock(options.root),
  );
  const planFile = String(options.values.plan ?? DEFAULT_PLAN_FILE);
  if (options.values.check !== true) {
    writePlan(options.root, planFile, {
      schemaVersion: '1.0',
      digest: planned.digest,
      plan: planned.plan,
    });
  }
  return {
    command: 'plan',
    status: planned.plan.localEffects.length === 0 ? 'success' : 'findings',
    exitClass: planned.plan.localEffects.length === 0 ? 'success' : 'findings',
    summary:
      planned.plan.localEffects.length === 0
        ? 'No local changes are pending.'
        : 'A reviewable operation plan is ready.',
    data: {
      digest: planned.digest,
      planFile,
      effects: planned.plan.localEffects.map(({ id, path }) => ({ id, path })),
    },
  };
}
