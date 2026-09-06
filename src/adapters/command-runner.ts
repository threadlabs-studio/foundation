import { spawnSync } from 'node:child_process';

import type { VerificationResultState } from '../domain/control.js';

const allowedExecutables = new Set(['gh', 'git', 'node', 'npm', 'pnpm']);

export interface BoundedCommandOptions {
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
  readonly canceled?: () => boolean;
  readonly input?: string;
}

export interface BoundedCommandResult {
  readonly state: VerificationResultState;
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly truncated: boolean;
}

function redact(value: string): string {
  const home = process.env.HOME;
  return value
    .replace(/\b(?:gh[opusr]_|npm_)[A-Za-z0-9_=-]{8,}\b/gu, '<redacted>')
    .replaceAll(home === undefined ? '\0unlikely-home\0' : home, '<home>');
}

function truncateUtf8(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value);
  return bytes.byteLength <= maxBytes ? value : bytes.subarray(0, maxBytes).toString('utf8');
}

export function runBoundedCommand(
  executable: string,
  arguments_: readonly string[],
  cwd: string,
  options: BoundedCommandOptions = {},
): BoundedCommandResult {
  if (!allowedExecutables.has(executable))
    throw new Error(`Executable is not allowlisted: ${executable}`);
  if (arguments_.some((argument) => /[\0\r\n]/u.test(argument))) {
    throw new Error('Command argument contains a forbidden control character.');
  }
  if (options.canceled?.() === true) {
    return {
      state: 'canceled',
      status: null,
      stdout: '',
      stderr: '',
      durationMs: 0,
      truncated: false,
    };
  }
  const maxOutputBytes = options.maxOutputBytes ?? 64 * 1024;
  const started = performance.now();
  const result = spawnSync(executable, arguments_, {
    cwd,
    encoding: 'utf8',
    shell: false,
    timeout: options.timeoutMs ?? 5 * 60 * 1000,
    maxBuffer: Math.max(1024 * 1024, maxOutputBytes * 4),
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CI: '1',
      FORCE_COLOR: '0',
    },
    ...(options.input === undefined ? {} : { input: options.input }),
  });
  const rawOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const truncated = Buffer.byteLength(rawOutput) > maxOutputBytes;
  const stdout = truncateUtf8(redact(String(result.stdout ?? '')), maxOutputBytes);
  const remaining = Math.max(0, maxOutputBytes - Buffer.byteLength(stdout));
  const stderr = truncateUtf8(redact(String(result.stderr ?? '')), remaining);
  const timedOut =
    result.error !== undefined && 'code' in result.error && result.error.code === 'ETIMEDOUT';
  return {
    state: timedOut ? 'unknown' : result.status === 0 ? 'passed' : 'failed',
    status: result.status,
    stdout,
    stderr,
    durationMs: Math.round(performance.now() - started),
    truncated,
  };
}
