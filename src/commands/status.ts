import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { loadConfig, loadLock } from './context.js';
import type { CommandOptions, CommandResult } from './types.js';

export function statusCommand(options: CommandOptions): CommandResult {
  const operations = join(options.root, '.threadlabs', 'operations');
  const operationCount = existsSync(operations)
    ? readdirSync(operations).filter((name) => name.endsWith('.jsonl')).length
    : 0;
  const managed = loadConfig(options.root) !== undefined;
  return {
    command: 'status',
    status: managed ? 'success' : 'findings',
    exitClass: managed ? 'success' : 'findings',
    summary: managed ? 'Repository has a Foundation manifest.' : 'Repository is not managed yet.',
    data: { managed, locked: loadLock(options.root) !== undefined, operationCount },
  };
}
