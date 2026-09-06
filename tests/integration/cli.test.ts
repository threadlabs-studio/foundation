import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../../src/cli.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function invoke(arguments_: readonly string[]): { exit: number; stdout: string; stderr: string } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exit = runCli(arguments_, {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });
  return { exit, stdout: stdout.join(''), stderr: stderr.join('') };
}

describe('CLI lifecycle', () => {
  it('initializes by preview, digest approval, apply, and conforming audit', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-cli-'));
    roots.push(root);
    const preview = invoke([
      'init',
      root,
      '--name',
      'sample-library',
      '--description',
      'A sample library.',
      '--owner',
      'Sample Authors',
      '--bundle',
      'typescript-library',
      '--json',
    ]);
    expect(preview.exit).toBe(0);
    const previewEnvelope = JSON.parse(preview.stdout) as {
      data: { digest: string; planFile: string; effects: readonly { path: string }[] };
    };
    expect(previewEnvelope.data.effects.map((effect) => effect.path)).toContain('package.json');
    expect(existsSync(join(root, 'package.json'))).toBe(false);

    const applied = invoke([
      'apply',
      root,
      '--plan',
      previewEnvelope.data.planFile,
      '--digest',
      previewEnvelope.data.digest,
      '--json',
    ]);
    expect(applied.exit).toBe(0);
    expect(existsSync(join(root, 'package.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name).toBe(
      'sample-library',
    );

    const audit = invoke(['audit', root, '--json']);
    expect(audit.exit).toBe(0);
    expect(JSON.parse(audit.stdout)).toEqual(expect.objectContaining({ status: 'success' }));
  });

  it('routes a nonempty unmanaged target to audit-first without a plan', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-cli-'));
    roots.push(root);
    writeFileSync(join(root, 'README.md'), '# Existing\n');
    const result = invoke(['init', root, '--name', 'existing', '--json']);
    expect(result.exit).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({ command: 'init', status: 'findings' }),
    );
    expect(existsSync(join(root, '.threadlabs', 'plans', 'latest.json'))).toBe(false);
  });

  it.each(['status', 'explain', 'clean'])(
    '%s has a noninteractive machine operation',
    (command) => {
      const root = mkdtempSync(join(tmpdir(), 'threadlabs-cli-'));
      roots.push(root);
      const result = invoke([command, root, '--json']);
      expect([0, 1, 2]).toContain(result.exit);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    },
  );
});
