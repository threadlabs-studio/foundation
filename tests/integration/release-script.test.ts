import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { renderTemplate } from '../../src/templates/index.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

// Stand-ins for npm and gh: each call is logged, and npm knows only the name `known`, with no versions to view.
const fakeNpm = `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(process.env.CALLS, ['npm', ...args].join(' ') + '\\n');
if (args[0] === 'pack') { console.log(JSON.stringify([{ filename: 'package.tgz', integrity: 'sha512-reviewed' }])); process.exit(0); }
if (args[0] === 'view') {
  if (args[1] === 'known' && args[2] === 'name') { console.log('"known"'); process.exit(0); }
  console.error('npm error code E404'); process.exit(1);
}
process.exit(0);
`;
const fakeGh = `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(process.env.CALLS, ['gh', ...args].join(' ') + '\\n');
if (args[1] === 'view') { console.error('release not found'); process.exit(1); }
process.exit(0);
`;

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), 'threadlabs-release-script-'));
  temporaryDirectories.push(root);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'known', version: '1.2.3' }));
  mkdirSync(join(root, 'packages/fresh'), { recursive: true });
  writeFileSync(join(root, 'packages/fresh/package.json'), JSON.stringify({ name: 'fresh', version: '1.2.3' }));
  mkdirSync(join(root, 'scripts'));
  writeFileSync(
    join(root, 'scripts/release.mjs'),
    renderTemplate('npm/release-script', { projectName: 'known', description: '', licenseHolder: 'example' }),
  );
  mkdirSync(join(root, 'bin'));
  for (const [name, source] of [['npm', fakeNpm], ['gh', fakeGh]] as const) {
    writeFileSync(join(root, 'bin', name), source);
    chmodSync(join(root, 'bin', name), 0o755);
  }
  return root;
}

describe('release runner', () => {
  // The release job runs on Linux, and Windows spawns no extensionless stand-in without a shell.
  it.skipIf(process.platform === 'win32')('skips a package npm has never seen, naming the trusted publisher to add, and publishes the others', () => {
    const root = repository();
    const calls = join(root, 'calls.log');
    const result = spawnSync(process.execPath, ['scripts/release.mjs'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        CALLS: calls,
        PATH: join(root, 'bin') + delimiter + (process.env.PATH ?? ''),
        GITHUB_REPOSITORY: 'example/known',
        GITHUB_WORKFLOW_REF: 'example/known/.github/workflows/release.yml@refs/heads/main',
        GITHUB_SHA: 'abc123',
      },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      'Skipping fresh@1.2.3: fresh is not on npm yet. Publish it once by hand from a clean checkout of abc123 ' +
        '(npm publish --access public in packages/fresh), then add example/known with workflow release.yml and ' +
        'environment npm as its trusted publisher on npmjs.com. The next release run publishes it here.',
    );
    const log = readFileSync(calls, 'utf8').trim().split('\n');
    expect(log).toContain('npm publish package.tgz --provenance --access public');
    expect(log.filter((line) => line.startsWith('npm publish'))).toHaveLength(1);
    expect(log).toContain('gh release create known@1.2.3 --generate-notes --target abc123');
    expect(log.some((line) => line.includes('fresh@1.2.3') && line.startsWith('gh'))).toBe(false);
  });
});
