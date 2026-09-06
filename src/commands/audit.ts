import { auditRepository } from '../engine/audit.js';
import { loadConfig, loadLock } from './context.js';
import type { CommandOptions, CommandResult } from './types.js';

export function auditCommand(options: CommandOptions): CommandResult {
  const config = loadConfig(options.root);
  const lock = loadLock(options.root);
  const report = auditRepository(options.root, {
    ...(config === undefined ? {} : { config }),
    ...(lock === undefined ? {} : { lock }),
  });
  const exceptedControls = new Set(
    report.findings.filter(({ state }) => state === 'exception').map(({ controlId }) => controlId),
  );
  const actionable = report.findings.some(
    (finding) =>
      finding.state !== 'conformant' &&
      finding.state !== 'exception' &&
      !exceptedControls.has(finding.controlId),
  );
  return {
    command: 'audit',
    status: actionable ? 'findings' : 'success',
    exitClass: actionable ? 'findings' : 'success',
    summary: actionable
      ? 'Repository audit found gaps or unknowns.'
      : 'Repository matches its managed standard.',
    data: report,
  };
}
