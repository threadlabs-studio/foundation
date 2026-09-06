import { applyOperationPlan } from '../engine/apply.js';
import { auditRepository } from '../engine/audit.js';
import { DEFAULT_PLAN_FILE, loadConfig, loadLock, readPlan } from './context.js';
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
  const config = loadConfig(options.root);
  const lock = loadLock(options.root);
  const postAudit = auditRepository(options.root, {
    ...(config === undefined ? {} : { config }),
    ...(lock === undefined ? {} : { lock }),
  });
  const remainingFindings = postAudit.findings
    .filter(({ state }) => state !== 'conformant' && state !== 'exception')
    .map(({ controlId, state, title }) => ({ controlId, state, title }));
  return {
    command,
    status: 'success',
    exitClass: 'success',
    summary:
      result.state === 'no-op'
        ? 'All postconditions already hold.'
        : 'Local plan applied successfully.',
    data: { ...result, remainingFindings },
  };
}
