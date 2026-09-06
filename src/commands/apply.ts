import { applyOperationPlan } from '../engine/apply.js';
import { DEFAULT_PLAN_FILE, readPlan } from './context.js';
import type { CommandOptions, CommandResult } from './types.js';

export function applyCommand(options: CommandOptions, command = 'apply'): CommandResult {
  const planFile = String(options.values.plan ?? DEFAULT_PLAN_FILE);
  const approvedDigest = String(options.values.digest ?? '');
  if (approvedDigest.length === 0)
    throw new Error('--digest is required; copy it from the reviewed plan.');
  const persisted = readPlan(options.root, planFile);
  if (persisted.digest !== approvedDigest)
    throw new Error('The supplied digest does not match the plan file.');
  const result = applyOperationPlan(options.root, persisted.plan, approvedDigest);
  return {
    command,
    status: 'success',
    exitClass: 'success',
    summary:
      result.state === 'no-op'
        ? 'All postconditions already hold.'
        : 'Local plan applied successfully.',
    data: result,
  };
}
