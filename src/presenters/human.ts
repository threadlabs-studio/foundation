import type { CommandResult } from '../commands/types.js';

export function presentHuman(result: CommandResult): string {
  const lines = [result.summary];
  if (typeof result.data === 'object' && result.data !== null && 'digest' in result.data) {
    lines.push(`Plan digest: ${String((result.data as { digest: unknown }).digest)}`);
  }
  if (typeof result.data === 'object' && result.data !== null && 'effects' in result.data) {
    for (const effect of (result.data as { effects: readonly { path: string }[] }).effects) {
      lines.push(`  ${effect.path}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
