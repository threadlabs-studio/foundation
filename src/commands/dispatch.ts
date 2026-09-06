import { applyCommand } from './apply.js';
import { auditCommand } from './audit.js';
import { cleanCommand } from './clean.js';
import { explainCommand } from './explain.js';
import { freshnessCommand } from './freshness.js';
import { githubCommand } from './github.js';
import { initCommand } from './init.js';
import { planCommand } from './plan.js';
import { statusCommand } from './status.js';
import type { CommandOptions, CommandResult } from './types.js';
import { upgradeCommand } from './upgrade.js';
import { verifyCommand } from './verify.js';

export function dispatchCommand(command: string, options: CommandOptions): CommandResult {
  switch (command) {
    case 'init':
      return initCommand(options);
    case 'audit':
      return auditCommand(options);
    case 'plan':
      return planCommand(options);
    case 'apply':
      return applyCommand(options);
    case 'resume':
      return applyCommand(options, 'resume');
    case 'upgrade':
      return upgradeCommand(options);
    case 'status':
      return statusCommand(options);
    case 'explain':
      return explainCommand(options);
    case 'clean':
      return cleanCommand(options);
    case 'verify':
      return verifyCommand(options);
    case 'freshness':
      return freshnessCommand(options);
    case 'github':
      return githubCommand(options);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
