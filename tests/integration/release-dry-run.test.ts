import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { validateReleaseRepository } from '../../src/engine/release.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), 'threadlabs-release-'));
  temporaryDirectories.push(root);
  mkdirSync(join(root, 'dist'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: '@example/package',
      version: '1.2.3',
      files: ['dist'],
      exports: { '.': './dist/index.js' },
    }),
  );
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\n## 1.2.3\n\n- First release.\n');
  writeFileSync(join(root, 'dist/index.js'), 'export const value = 1;\n');
  return root;
}

describe('release dry run', () => {
  it('validates clean build, changelog, version, and package contents without publishing', () => {
    const commands: string[][] = [];
    const result = validateReleaseRepository(repository(), 'single-package', {
      run: (executable, arguments_) => {
        commands.push([executable, ...arguments_]);
        if (executable === 'git') return { state: 'passed', stdout: '' };
        if (arguments_.includes('build')) return { state: 'passed', stdout: '' };
        return {
          state: 'passed',
          stdout: JSON.stringify([
            {
              files: [
                { path: 'package.json' },
                { path: 'CHANGELOG.md' },
                { path: 'dist/index.js' },
              ],
            },
          ]),
        };
      },
    });

    expect(result.state).toBe('passed');
    expect(commands).toContainEqual(['npm', 'pack', '--dry-run', '--json', '--ignore-scripts']);
    expect(commands.flat()).not.toContain('publish');
  });

  it.each<[string, { readonly git?: string; readonly build?: string; readonly pack?: string }]>([
    ['dirty checkout', { git: ' M package.json' }],
    ['failed build', { build: 'failed' }],
    ['unexpected package file', { pack: 'secrets.txt' }],
  ])('rejects %s', (_, fault) => {
    const result = validateReleaseRepository(repository(), 'single-package', {
      run: (executable, arguments_) => {
        if (executable === 'git') return { state: 'passed', stdout: fault.git ?? '' };
        if (arguments_.includes('build')) {
          return { state: fault.build === 'failed' ? 'failed' : 'passed', stdout: '' };
        }
        return {
          state: 'passed',
          stdout: JSON.stringify([{ files: [{ path: fault.pack ?? 'dist/index.js' }] }]),
        };
      },
    });

    expect(result.state).toBe('failed');
  });

  it('rejects missing changelog and placeholder versions before running commands', () => {
    const root = repository();
    const manifest = JSON.parse('{"name":"@example/package","version":"0.0.0","files":["dist"]}');
    writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
    rmSync(join(root, 'CHANGELOG.md'));
    const result = validateReleaseRepository(root, 'single-package', {
      run: () => ({ state: 'passed', stdout: '' }),
    });

    expect(result.state).toBe('failed');
    expect(result.checks.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['release.changelog', 'release.version']),
    );
  });
});
