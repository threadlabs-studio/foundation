import { validateReleaseRepository } from '../engine/release.js';
import { loadConfig } from './context.js';
import type { CommandOptions, CommandResult } from './types.js';

export function releaseCommand(options: CommandOptions): CommandResult {
  if (options.values.action === 'publish') {
    throw new Error('The local CLI never publishes; use the protected reviewed release workflow.');
  }
  const config = loadConfig(options.root);
  if (config?.release === undefined) {
    throw new Error('A release strategy is required in threadlabs.config.json.');
  }
  const validation = validateReleaseRepository(options.root, config.release.strategy);
  return {
    command: 'release',
    status:
      validation.state === 'passed'
        ? 'success'
        : validation.state === 'failed'
          ? 'failed'
          : 'findings',
    exitClass:
      validation.state === 'passed'
        ? 'success'
        : validation.state === 'failed'
          ? 'mutationFailed'
          : 'unavailableEvidence',
    summary: `Release validation ${validation.state}; no package was published.`,
    data: validation,
  };
}
