import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import type { CommandOptions, CommandResult } from './types.js';

export function cleanCommand(options: CommandOptions): CommandResult {
  const plans = join(options.root, '.threadlabs', 'plans');
  if (options.values.yes !== true) {
    return {
      command: 'clean',
      status: 'findings',
      exitClass: 'findings',
      summary: 'Pass --yes to remove saved preview plans; operation journals are retained.',
      data: { wouldRemove: existsSync(plans) ? ['.threadlabs/plans'] : [] },
    };
  }
  if (existsSync(plans)) rmSync(plans, { recursive: true, force: true });
  return {
    command: 'clean',
    status: 'success',
    exitClass: 'success',
    summary: 'Saved preview plans removed; operation journals retained for recovery evidence.',
    data: { removed: ['.threadlabs/plans'] },
  };
}
