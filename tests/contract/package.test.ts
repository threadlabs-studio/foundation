import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../../src/cli.js';
import { packageName } from '../../src/index.js';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const temporaryDirectories: string[] = [];
const useCommandShell = process.platform === 'win32';

function makeTemporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('public package contract', () => {
  it('exposes a stable library name', () => {
    expect(packageName).toBe('threadlabs');
  });

  it('prints help successfully', () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = runCli(['--help'], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join('')).toContain('Usage: threadlabs');
    expect(stderr).toEqual([]);
  });

  it('rejects an unknown command without a stack trace', () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = runCli(['not-a-command'], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(exitCode).toBe(2);
    expect(stdout).toEqual([]);
    expect(stderr.join('')).toBe(
      'Unknown command: not-a-command\nRun "threadlabs --help" for usage.\n',
    );
    expect(stderr.join('')).not.toMatch(/\n\s+at\s/u);
  });

  it('packs a clean tarball that installs into a synthetic consumer', () => {
    const packDirectory = makeTemporaryDirectory('threadlabs-pack-');
    const consumerDirectory = makeTemporaryDirectory('threadlabs-consumer-');
    const sourceManifest = JSON.parse(
      readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: unknown;
      devDependencies?: unknown;
      devEngines?: unknown;
      packageManager?: unknown;
      scripts?: Readonly<Record<string, string>>;
    };

    expect(sourceManifest.devEngines).toEqual({
      runtime: { name: 'node', version: '>=24 <25', onFail: 'warn' },
    });
    expect(sourceManifest.packageManager).toBe('pnpm@11.25.0');
    expect(sourceManifest.scripts?.lint).toBe('oxlint --deny-warnings .');
    expect(sourceManifest.dependencies).toEqual({
      '@inquirer/prompts': '8.7.1',
      semver: '7.8.5',
    });
    expect(sourceManifest.devDependencies).toEqual({
      '@types/node': '22.20.1',
      '@types/semver': '7.8.0',
      oxlint: '1.81.0',
      typescript: '7.0.2',
      vitest: '5.0.0',
    });

    const packOutput = execFileSync(
      'corepack',
      ['pnpm@11.25.0', 'pack', '--pack-destination', packDirectory],
      { cwd: repositoryRoot, encoding: 'utf8', shell: useCommandShell },
    );
    const tarballName = packOutput.trim().split('\n').at(-1);

    expect(tarballName).toBeDefined();
    const tarballPath = isAbsolute(tarballName!) ? tarballName! : join(packDirectory, tarballName!);

    const packedPaths = execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' })
      .trim()
      .split(/\r?\n/u)
      .map((path) => path.replace(/^package\//u, ''));

    expect(packedPaths).toEqual(
      expect.arrayContaining([
        'dist/cli.d.ts',
        'dist/cli.d.ts.map',
        'dist/cli.js',
        'dist/cli.js.map',
        'dist/index.d.ts',
        'dist/index.d.ts.map',
        'dist/index.js',
        'dist/index.js.map',
        'package.json',
      ]),
    );
    expect(packedPaths.some((path) => /^(docs|tests)\//u.test(path))).toBe(false);
    expect(
      packedPaths.some((path) =>
        /^(?:oxlint\.json|tsconfig(?:\.build)?\.json|vitest\.config\.ts)$/u.test(
          path,
        ),
      ),
    ).toBe(false);

    writeFileSync(
      join(consumerDirectory, 'package.json'),
      JSON.stringify({ name: 'threadlabs-package-consumer', private: true, type: 'module' }),
    );
    execFileSync(
      'npm',
      ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarballPath],
      {
        cwd: consumerDirectory,
        shell: useCommandShell,
        stdio: 'pipe',
      },
    );

    const importedName = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        "import { packageName } from 'threadlabs'; process.stdout.write(packageName);",
      ],
      { cwd: consumerDirectory, encoding: 'utf8' },
    );
    expect(importedName).toBe('threadlabs');

    const binaryName = process.platform === 'win32' ? 'threadlabs.cmd' : 'threadlabs';
    const installedBinary = join(consumerDirectory, 'node_modules', '.bin', binaryName);
    const helpResult = spawnSync(installedBinary, ['--help'], {
      encoding: 'utf8',
      shell: useCommandShell,
    });
    expect(helpResult.status).toBe(0);
    expect(helpResult.stdout).toContain('Usage: threadlabs');
    expect(helpResult.stderr).toBe('');

    const invalidResult = spawnSync(installedBinary, ['not-a-command'], {
      encoding: 'utf8',
      shell: useCommandShell,
    });
    expect(invalidResult.status).toBe(2);
    expect(invalidResult.stdout).toBe('');
    expect(invalidResult.stderr).toBe(
      'Unknown command: not-a-command\nRun "threadlabs --help" for usage.\n',
    );

    const installedManifest = JSON.parse(
      readFileSync(join(consumerDirectory, 'node_modules', 'threadlabs', 'package.json'), 'utf8'),
    ) as {
      bin?: unknown;
      dependencies?: unknown;
      engines?: unknown;
      exports?: unknown;
      files?: unknown;
      license?: unknown;
      repository?: { url?: unknown };
    };
    expect(installedManifest.exports).toBeDefined();
    expect(installedManifest.bin).toEqual({ threadlabs: './dist/cli.js' });
    expect(installedManifest.engines).toEqual({ node: '>=22.13 <23 || >=24 <25' });
    expect(installedManifest.files).toEqual(['dist', 'schemas', 'templates']);
    expect(installedManifest.dependencies).toEqual({
      '@inquirer/prompts': '8.7.1',
      semver: '7.8.5',
    });
    expect(installedManifest.license).toBe('MIT');
    expect(installedManifest.repository?.url).toBe(
      'git+https://github.com/threadlabs-studio/foundation.git',
    );
  });
});
