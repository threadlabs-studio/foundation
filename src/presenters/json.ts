import { canonicalJson } from '../domain/canonicalize.js';
import type { CommandResult } from '../commands/types.js';

export function presentJson(result: CommandResult): string {
  return canonicalJson({
    schemaVersion: '1.0',
    command: result.command,
    status: result.status,
    exitClass: result.exitClass,
    data: result.data,
  });
}
