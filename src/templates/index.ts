/* oxlint-disable no-useless-escape -- escapes are emitted into generated JSON strings */
export interface TemplateContext {
  readonly projectName: string;
  readonly description: string;
  readonly licenseHolder: string;
  readonly licenseYear?: number;
}

const templates: Readonly<Record<string, string>> = {
  'core/gitignore': `node_modules/
dist/
coverage/
.threadlabs/
*.tgz
.DS_Store
`,
  'core/license-mit': `MIT License

Copyright (c) {{year}} {{licenseHolder}}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,
  'core/readme': `# {{projectTitle}}

{{description}}

## Development

One-time setup (commit the generated \`pnpm-lock.yaml\`):

\`\`\`sh
corepack pnpm install
\`\`\`

Normal development:

\`\`\`sh
corepack pnpm install --frozen-lockfile
corepack pnpm verify:pr
\`\`\`

## License

[MIT](LICENSE)
`,
  'typescript/package-json': `{
  "name": "{{projectName}}",
  "version": "0.0.0",
  "description": "{{descriptionJson}}",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "engines": { "node": ">=22.13 <23 || >=24 <25" },
  "packageManager": "pnpm@11.25.0",
  "scripts": {
    "clean": "node --input-type=module --eval \\\"import { rmSync } from 'node:fs'; rmSync('dist', { recursive: true, force: true });\\\"",
    "build": "pnpm clean && tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json",
    "lint": "oxlint --deny-warnings .",
    "test": "vitest run --exclude tests/package.test.ts",
    "test:package": "vitest run tests/package.test.ts",
    "verify:inner": "pnpm lint && pnpm typecheck && pnpm test",
    "verify:pr": "pnpm verify:inner && pnpm build && pnpm test:package",
    "verify:extended": "pnpm verify:pr",
    "verify:release": "pnpm verify:pr && pnpm pack --dry-run",
    "prepack": "pnpm build"
  },
  "devDependencies": {
    "@types/node": "22.20.1",
    "oxlint": "1.81.0",
    "typescript": "7.0.2",
    "vitest": "5.0.0"
  }
}
`,
  'typescript/pnpm-workspace': `# Exact exceptions for the pinned release set; other releases retain pnpm's age gate.
minimumReleaseAgeExclude:
  - '@vitest/mocker@5.0.0'
  - '@vitest/spy@5.0.0'
  - 'postcss@8.5.28'
  - 'vitest@5.0.0'
`,
  'typescript/tsconfig': `{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"],
  "exclude": ["dist", "coverage", "node_modules"]
}
`,
  'typescript/tsconfig-build': `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests", "dist", "coverage", "node_modules"]
}
`,
  'typescript/oxlint': `{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "categories": { "correctness": "error", "suspicious": "warn" }
}
`,
  'typescript/vitest': `import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
`,
  'typescript/index': `export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
`,
  'typescript/test': `import { describe, expect, it } from 'vitest';

import { hello } from '../src/index.js';

describe('hello', () => {
  it('returns a greeting', () => expect(hello('world')).toBe('Hello, world!'));
});
`,
  'public-api/package-test': `import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const workspace = mkdtempSync(join(tmpdir(), 'package-consumer-'));
const useCommandShell = process.platform === 'win32';

afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe('published package contract', () => {
  it('installs from its tarball and exposes the declared import', () => {
    const packed = execFileSync(
      'corepack',
      ['pnpm', 'pack', '--pack-destination', workspace],
      { cwd: root, encoding: 'utf8', shell: useCommandShell },
    )
      .trim()
      .split('\\n')
      .at(-1);
    expect(packed).toBeDefined();
    const tarball = isAbsolute(packed!) ? packed! : join(workspace, packed!);
    writeFileSync(
      join(workspace, 'package.json'),
      JSON.stringify({ name: 'package-consumer', private: true, type: 'module' }),
    );
    execFileSync(
      'npm',
      ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball],
      { cwd: workspace, shell: useCommandShell },
    );
    const installed = JSON.parse(
      readFileSync(join(workspace, 'node_modules', '{{projectName}}', 'package.json'), 'utf8'),
    );
    expect(installed.exports).toBeDefined();
    expect(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          "import('{{projectName}}').then(() => process.stdout.write('ok'))",
        ],
        { cwd: workspace, encoding: 'utf8' },
      ),
    ).toBe('ok');
  });
});
`,
  'github/ci': `name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: Node \${{ matrix.node }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: ['22.13.1', '24']
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: \${{ matrix.node }}
          package-manager-cache: false
      # Corepack owns the pnpm/Yarn shims; --force replaces runner-provided shims in this ephemeral job.
      - run: npm install --global --ignore-scripts --force corepack@0.34.0
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify:pr

  required:
    name: Required
    if: always()
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - run: test "\${{ needs.verify.result }}" = success
`,
  'github/dependabot': `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    cooldown:
      default-days: 1
      semver-major-days: 30
      semver-minor-days: 1
      semver-patch-days: 1
    groups:
      compatible:
        update-types: [minor, patch]
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
`,
  'github/release': `name: Release

on:
  workflow_dispatch:
    inputs:
      approve:
        description: Publish the reviewed immutable versions
        required: true
        type: boolean

permissions:
  contents: write
  id-token: write

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  publish:
    if: inputs.approve
    runs-on: ubuntu-latest
    environment: npm
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '24'
          registry-url: https://registry.npmjs.org
          package-manager-cache: false
      # Corepack owns the pnpm/Yarn shims; --force replaces runner-provided shims in this ephemeral job.
      - run: npm install --global --ignore-scripts --force corepack@0.34.0
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify:release
      - run: node scripts/release.mjs
        env:
          GH_TOKEN: \${{ github.token }}
`,
  'github/cross-platform': `name: Cross-platform

on:
  pull_request:

permissions:
  contents: read

concurrency:
  group: extended-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: \${{ matrix.os }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '24'
          package-manager-cache: false
      # Corepack owns the pnpm/Yarn shims; --force replaces runner-provided shims in this ephemeral job.
      - run: npm install --global --ignore-scripts --force corepack@0.34.0
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify:extended
`,
  'agents/root': `# Repository guidance

## Authority

- Treat README.md and checked-in project documentation as product authority.
- Treat threadlabs.config.json as the repository-standard manifest.
- Ask the owner when requirements conflict or a destructive operation is required.

## Safe work

- Preserve unrelated changes and never rewrite shared Git history without explicit approval.
- Preview Foundation plans before applying them.
- Check threadlabs.config.json for each path's ownership mode before editing. For managed paths, use .threadlabs.lock.json to confirm the last-applied content and change the owning Foundation template; preserve local paths and stop on ambiguous ownership.
- Use Oxlint for JavaScript and TypeScript linting. Do not add Prettier or another repository-wide formatter.
- Do not add Tailwind. Use project-owned CSS, CSS Modules, or an explicitly selected non-Tailwind styling approach.

## Verification

- During development, run the smallest focused test plus \`pnpm verify:inner\`.
- Before handoff, run \`pnpm verify:pr\` and report commands, results, skips, and remaining judgment.
- Publication remains human-approved and runs only through the protected release workflow.
`,
  'agents/claude': `@AGENTS.md
`,
  'generated/gitattributes': `* text=auto eol=lf
dist/** linguist-generated=true
*.lock linguist-generated=true
`,
  'docs/readme': `# Documentation

This directory contains the project's maintained documentation. Document shipped behavior and keep future work clearly labeled.
`,
  'npm/changelog': `# Changelog

All notable changes to this project will be documented in this file.
`,
  'npm/changesets-fixed': `{
  "$schema": "https://unpkg.com/@changesets/config@4.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [["*"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
`,
  'npm/changesets-independent': `{
  "$schema": "https://unpkg.com/@changesets/config@4.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
`,
  'npm/changesets-prerelease-channel': `{
  "$schema": "https://unpkg.com/@changesets/config@4.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
`,
  'npm/changesets-prerelease-state': `{
  "mode": "pre",
  "tag": "next",
  "initialVersions": {},
  "changesets": []
}
`,
  'npm/changesets-readme': `# Changesets

Add a changeset for each user-visible change. Fixed, independent, and prerelease version behavior is selected by the checked-in Threadlabs release strategy.

\`\`\`sh
corepack pnpm dlx @changesets/cli@3.0.2 add
corepack pnpm dlx @changesets/cli@3.0.2 version
\`\`\`
`,
  'npm/exceptional-release': `# Exceptional multi-artifact release

This repository intentionally coordinates more than npm packages. Document the artifact inventory, immutable identity, provenance check, publication order, recovery observation, and human approval boundary here before enabling publication.
`,
  'npm/release-script': `import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: false });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function packages(root) {
  const paths = [join(root, 'package.json')];
  const workspace = join(root, 'packages');
  if (existsSync(workspace)) {
    for (const entry of readdirSync(workspace, { withFileTypes: true })) {
      const path = join(workspace, entry.name, 'package.json');
      if (entry.isDirectory() && existsSync(path)) paths.push(path);
    }
  }
  return paths.map((path) => ({ root: dirname(path), manifest: JSON.parse(readFileSync(path)) }))
    .filter(({ manifest }) => manifest.private !== true && manifest.name && manifest.version);
}

function missing(result) {
  return result.status !== 0 && /E404|HTTP 404|release not found/i.test(result.stderr);
}

const root = resolve('.');
for (const candidate of packages(root)) {
  const id = candidate.manifest.name + '@' + candidate.manifest.version;
  const packed = run('npm', ['pack', '--json'], candidate.root);
  if (packed.status !== 0) throw new Error('Cannot inspect ' + id + ': ' + packed.stderr);
  const packageFile = JSON.parse(packed.stdout)[0];
  const expected = packageFile?.integrity;
  if (!expected || !packageFile.filename) throw new Error('npm pack did not report integrity for ' + id);

  const observed = run('npm', ['view', id, 'dist.integrity', '--json'], candidate.root);
  if (observed.status === 0) {
    const actual = JSON.parse(observed.stdout);
    if (actual !== expected) throw new Error('Immutable registry conflict for ' + id);
  } else if (missing(observed)) {
    const published = run(
      'npm',
      ['publish', packageFile.filename, '--provenance', '--access', 'public'],
      candidate.root,
    );
    if (published.status !== 0) throw new Error('Publication failed for ' + id + ': ' + published.stderr);
  } else {
    throw new Error('Registry state is unknown for ' + id + ': ' + observed.stderr);
  }

  const safeName = candidate.manifest.name.replace(/^@/, '').replaceAll('/', '-');
  const tag = safeName + '@' + candidate.manifest.version;
  const release = run('gh', ['release', 'view', tag], root);
  if (release.status === 0) continue;
  if (!missing(release)) throw new Error('Source release state is unknown for ' + tag);
  const created = run(
    'gh',
    ['release', 'create', tag, '--generate-notes', '--target', process.env.GITHUB_SHA ?? 'HEAD'],
    root,
  );
  if (created.status !== 0) throw new Error('Source release failed for ' + tag + ': ' + created.stderr);
}
`,
};

function titleFromName(name: string): string {
  return name
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

export function renderTemplate(name: string, context: TemplateContext): string {
  const template = templates[name];
  if (template === undefined) throw new Error(`Unknown template: ${name}`);
  const replacements: Record<string, string> = {
    projectName: context.projectName,
    projectTitle: titleFromName(context.projectName),
    description: context.description,
    descriptionJson: JSON.stringify(context.description).slice(1, -1),
    licenseHolder: context.licenseHolder,
    year: String(context.licenseYear ?? new Date().getUTCFullYear()),
  };
  return template.replace(/\{\{([A-Za-z]+)\}\}/gu, (_, key: string) => replacements[key] ?? '');
}

export function templateNames(): readonly string[] {
  return Object.keys(templates).toSorted();
}
