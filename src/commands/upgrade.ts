import type { ThreadlabsConfig } from '../domain/config.js';
import { createOperationPlan } from '../engine/plan.js';
import {
  contextFromConfig,
  DEFAULT_PLAN_FILE,
  loadConfig,
  loadLock,
  STANDARD_VERSION,
  writePlan,
} from './context.js';
import type { CommandOptions, CommandResult } from './types.js';

export function upgradeCommand(options: CommandOptions): CommandResult {
  const current = loadConfig(options.root);
  if (current === undefined) throw new Error('threadlabs.config.json is required before upgrade.');
  const config: ThreadlabsConfig = { ...current, standardVersion: STANDARD_VERSION };
  const planned = createOperationPlan(
    options.root,
    config,
    contextFromConfig(config),
    'upgrade',
    loadLock(options.root),
  );
  writePlan(options.root, DEFAULT_PLAN_FILE, {
    schemaVersion: '1.0',
    digest: planned.digest,
    plan: planned.plan,
  });
  return {
    command: 'upgrade',
    status: planned.plan.localEffects.length === 0 ? 'success' : 'findings',
    exitClass: planned.plan.localEffects.length === 0 ? 'success' : 'findings',
    summary: planned.plan.localEffects.length === 0 ? 'Already current.' : 'Upgrade plan created.',
    data: {
      digest: planned.digest,
      planFile: DEFAULT_PLAN_FILE,
      effects: planned.plan.localEffects,
    },
  };
}
