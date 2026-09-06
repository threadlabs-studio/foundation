import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runBoundedCommand } from '../../src/adapters/command-runner.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('bounded command runner', () => {
  it('runs allowlisted executables without a shell and bounds output', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-command-'));
    roots.push(root);
    const result = runBoundedCommand(
      'node',
      ['--eval', "process.stdout.write('x'.repeat(200))"],
      root,
      {
        maxOutputBytes: 32,
      },
    );
    expect(result.state).toBe('passed');
    expect(result.stdout.length).toBe(32);
    expect(result.truncated).toBe(true);
  });

  it('rejects unknown executables and hostile argument control characters', () => {
    expect(() => runBoundedCommand('sh', ['-c', 'echo unsafe'], '.')).toThrow(/allowlisted/iu);
    expect(() => runBoundedCommand('node', ['--eval', 'ok\nnext'], '.')).toThrow(
      /control character/iu,
    );
  });

  it('redacts home paths and credential-shaped output', () => {
    const result = runBoundedCommand(
      'node',
      ['--eval', 'process.stdout.write(`${process.env.HOME} gho_abcdefghijklmno`)'],
      '.',
    );
    expect(result.stdout).toBe('<home> <redacted>');
  });

  it('reports timeout and pre-cancellation distinctly', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-command-'));
    roots.push(root);
    writeFileSync(join(root, 'wait.mjs'), 'setTimeout(() => {}, 1000);');
    expect(runBoundedCommand('node', ['wait.mjs'], root, { timeoutMs: 5 }).state).toBe('unknown');
    expect(runBoundedCommand('node', ['--version'], root, { canceled: () => true }).state).toBe(
      'canceled',
    );
  });
});
