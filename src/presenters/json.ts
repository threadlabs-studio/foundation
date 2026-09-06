import { canonicalCompactJson } from '../domain/canonicalize.js';
import type { CommandResult } from '../commands/types.js';

export function presentJson(result: CommandResult): string {
  return canonicalCompactJson({
    schemaVersion: '1.0',
    command: result.command,
    status: result.status,
    exitClass: result.exitClass,
    summary: result.summary,
    data: result.data,
  });
}
