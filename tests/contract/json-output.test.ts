import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../../src/cli.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('machine output contract', () => {
  it('emits exactly one versioned JSON envelope and no decoration', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-json-'));
    roots.push(root);
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exit = runCli(['audit', root, '--json'], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });
    const envelope = JSON.parse(stdout.join('')) as Record<string, unknown>;
    expect(exit).toBe(1);
    expect(envelope).toEqual(
      expect.objectContaining({ schemaVersion: '1.0', command: 'audit', status: 'findings' }),
    );
    expect(stdout.join('').trim().split('\n')).toHaveLength(1);
    expect(stderr).toEqual([]);
  });

  it('emits invalid input as JSON when machine mode is selected', () => {
    const stdout: string[] = [];
    const exit = runCli(['audit', '--json', '--unexpected'], {
      stdout: (message) => stdout.push(message),
      stderr: () => undefined,
    });
    expect(exit).toBe(2);
    expect(JSON.parse(stdout.join(''))).toEqual(
      expect.objectContaining({ status: 'invalid-input', exitClass: 'invalidInput' }),
    );
  });
});
