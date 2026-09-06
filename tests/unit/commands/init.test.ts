import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli.js';
import { enrichInteractiveArguments } from '../../../src/presenters/interactive.js';
import { makeConfig } from '../../utils/config.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function jsonInvoke(arguments_: readonly string[]): { exit: number; data: { digest: string } } {
  let stdout = '';
  const exit = runCli(arguments_, {
    stdout: (value) => (stdout += value),
    stderr: () => undefined,
  });
  return { exit, data: (JSON.parse(stdout) as { data: { digest: string } }).data };
}

describe('initialization request parity', () => {
  it('produces the same plan from flags and an equivalent external manifest', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-init-parity-'));
    const configPath = join(tmpdir(), `threadlabs-config-${crypto.randomUUID()}.json`);
    roots.push(root);
    const config = {
      ...makeConfig([]),
      bundles: ['typescript-library'],
      release: { strategy: 'single-package' as const },
      settings: {
        projectName: 'sample-library',
        description: 'A sample library.',
        licenseHolder: 'Sample Authors',
      },
    };
    writeFileSync(configPath, JSON.stringify(config));
    roots.push(configPath);

    const flags = jsonInvoke([
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
    const manifest = jsonInvoke(['init', root, '--config', configPath, '--json']);
    expect(flags.exit).toBe(0);
    expect(manifest.exit).toBe(0);
    expect(flags.data.digest).toBe(manifest.data.digest);
  });

  it('does not prompt when interactive arguments are already complete', async () => {
    const arguments_ = ['init', '.', '--name', 'sample', '--bundle', 'typescript-library'];
    await expect(enrichInteractiveArguments(arguments_)).resolves.toEqual(arguments_);
  });
});
