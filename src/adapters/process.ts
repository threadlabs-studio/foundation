import { spawnSync } from 'node:child_process';

export interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export function runCommand(
  command: string,
  arguments_: readonly string[],
  cwd: string,
): CommandResult {
  const result = spawnSync(command, arguments_, { cwd, encoding: 'utf8', shell: false });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
