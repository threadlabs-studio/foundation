import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { runBoundedCommand } from '../adapters/command-runner.js';
import type { ReleaseStrategy } from '../domain/config.js';
import type { ArtifactDefinition } from '../domain/module.js';

export const RELEASE_STRATEGIES: readonly ReleaseStrategy[] = [
  'exceptional-multi-artifact',
  'fixed-monorepo',
  'independent-monorepo',
  'prerelease-channel',
  'single-package',
];

const coordinatedStrategies = new Set<ReleaseStrategy>([
  'fixed-monorepo',
  'independent-monorepo',
  'prerelease-channel',
]);

export function releaseArtifacts(strategy: ReleaseStrategy): readonly ArtifactDefinition[] {
  const artifacts: ArtifactDefinition[] = [
    {
      path: '.github/workflows/release.yml',
      ownership: 'managed',
      template: 'github/release',
    },
    { path: 'scripts/release.mjs', ownership: 'managed', template: 'npm/release-script' },
  ];
  if (coordinatedStrategies.has(strategy)) {
    artifacts.push(
      {
        path: '.changeset/config.json',
        ownership: 'managed',
        template: `npm/changesets-${strategy}`,
      },
      { path: '.changeset/README.md', ownership: 'managed', template: 'npm/changesets-readme' },
    );
  }
  if (strategy === 'prerelease-channel') {
    artifacts.push({
      path: '.changeset/pre.json',
      ownership: 'managed',
      template: 'npm/changesets-prerelease-state',
    });
  }
  if (strategy === 'exceptional-multi-artifact') {
    artifacts.push({
      path: 'docs/release-exception.md',
      ownership: 'managed',
      template: 'npm/exceptional-release',
    });
  }
  return artifacts;
}

type ObservedState = 'missing' | 'published' | 'unknown';

export interface PublicationObservation {
  readonly state: ObservedState;
  readonly integrity?: string;
}

export interface PublicationResumeInput {
  readonly packageName: string;
  readonly version: string;
  readonly expectedIntegrity: string;
  readonly registry: PublicationObservation;
  readonly sourceRelease: { readonly state: ObservedState };
}

export interface PublicationResumePlan {
  readonly state: 'ready' | 'blocked';
  readonly actions: readonly ('publish-package' | 'create-source-release')[];
  readonly reason?: string;
}

export function planPublicationResume(input: PublicationResumeInput): PublicationResumePlan {
  if (input.registry.state === 'unknown') {
    return {
      state: 'blocked',
      actions: [],
      reason: 'Registry state is unknown; observe it again before resuming.',
    };
  }
  if (
    input.registry.state === 'published' &&
    input.registry.integrity !== input.expectedIntegrity
  ) {
    return {
      state: 'blocked',
      actions: [],
      reason: `Immutable version conflict for ${input.packageName}@${input.version}.`,
    };
  }
  if (input.sourceRelease.state === 'unknown') {
    return {
      state: 'blocked',
      actions: [],
      reason: 'Source release state is unknown; observe it again before resuming.',
    };
  }
  return {
    state: 'ready',
    actions: [
      ...(input.registry.state === 'missing' ? (['publish-package'] as const) : []),
      ...(input.sourceRelease.state === 'missing' ? (['create-source-release'] as const) : []),
    ],
  };
}

export interface ReleaseCheck {
  readonly id: string;
  readonly state: 'passed' | 'failed' | 'unknown';
  readonly details: string;
}

export interface ReleaseValidation {
  readonly strategy: ReleaseStrategy;
  readonly state: 'passed' | 'failed' | 'unknown';
  readonly checks: readonly ReleaseCheck[];
}

interface CommandObservation {
  readonly state: 'passed' | 'failed' | 'unknown';
  readonly stdout: string;
  readonly stderr?: string;
}

export interface ReleaseValidationDependencies {
  readonly run: (
    executable: string,
    arguments_: readonly string[],
    cwd: string,
  ) => CommandObservation;
}

interface PackageManifest {
  readonly name?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly files?: readonly string[];
}

interface PublishablePackage {
  readonly root: string;
  readonly manifest: PackageManifest;
}

function readManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageManifest;
}

function discoverPackages(root: string): readonly PublishablePackage[] {
  const manifests = [join(root, 'package.json')];
  const packagesRoot = join(root, 'packages');
  if (existsSync(packagesRoot)) {
    for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
      const manifest = join(packagesRoot, entry.name, 'package.json');
      if (entry.isDirectory() && existsSync(manifest)) manifests.push(manifest);
    }
  }
  return manifests
    .map((path) => ({ root: dirname(path), manifest: readManifest(path) }))
    .filter(({ manifest }) => manifest.private !== true && manifest.name !== undefined);
}

function packagePathAllowed(path: string, files: readonly string[]): boolean {
  if (['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md'].includes(path)) return true;
  return files.some((allowed) => path === allowed || path.startsWith(`${allowed}/`));
}

function defaultRun(
  executable: string,
  arguments_: readonly string[],
  cwd: string,
): CommandObservation {
  const result = runBoundedCommand(executable, arguments_, cwd);
  const state = ['passed', 'failed', 'unknown'].includes(result.state)
    ? (result.state as CommandObservation['state'])
    : 'unknown';
  return { state, stdout: result.stdout, stderr: result.stderr };
}

export function validateReleaseRepository(
  root: string,
  strategy: ReleaseStrategy,
  dependencies: ReleaseValidationDependencies = { run: defaultRun },
): ReleaseValidation {
  const checks: ReleaseCheck[] = [];
  const packages = discoverPackages(root);
  if (packages.length === 0) {
    checks.push({
      id: 'release.packages',
      state: 'failed',
      details: 'No publishable package manifests were found.',
    });
  }

  const changelogPath = join(root, 'CHANGELOG.md');
  const changelog = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : '';
  const invalidVersions = packages.filter(
    ({ manifest }) =>
      manifest.version === undefined ||
      manifest.version === '0.0.0' ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(manifest.version),
  );
  checks.push({
    id: 'release.version',
    state: invalidVersions.length === 0 ? 'passed' : 'failed',
    details:
      invalidVersions.length === 0
        ? 'Every publishable package has a release version.'
        : 'A publishable package has a missing, placeholder, or invalid version.',
  });
  const missingChangelogVersions = packages.filter(
    ({ manifest }) => manifest.version !== undefined && !changelog.includes(manifest.version),
  );
  checks.push({
    id: 'release.changelog',
    state: changelog.length > 0 && missingChangelogVersions.length === 0 ? 'passed' : 'failed',
    details:
      changelog.length > 0 && missingChangelogVersions.length === 0
        ? 'The changelog names every release version.'
        : 'CHANGELOG.md is missing or does not name every release version.',
  });

  const git = dependencies.run('git', ['status', '--porcelain=v1'], root);
  checks.push({
    id: 'release.clean-checkout',
    state: git.state === 'passed' && git.stdout.trim().length === 0 ? 'passed' : 'failed',
    details:
      git.state === 'passed' && git.stdout.trim().length === 0
        ? 'The release checkout is clean.'
        : 'Release validation requires a clean checkout.',
  });

  const build = dependencies.run('pnpm', ['build'], root);
  checks.push({
    id: 'release.clean-build',
    state: build.state,
    details: build.state === 'passed' ? 'The clean build passed.' : 'The clean build did not pass.',
  });

  for (const candidate of packages) {
    const label = `${candidate.manifest.name ?? 'package'}@${candidate.manifest.version ?? 'unknown'}`;
    const pack = dependencies.run(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts'],
      candidate.root,
    );
    if (pack.state !== 'passed') {
      checks.push({
        id: `release.pack:${label}`,
        state: pack.state,
        details: 'Pack dry run failed.',
      });
      continue;
    }
    try {
      const parsed = JSON.parse(pack.stdout) as Array<{ files?: Array<{ path?: string }> }>;
      const paths =
        parsed[0]?.files?.flatMap(({ path }) => (path === undefined ? [] : [path])) ?? [];
      const allowed = candidate.manifest.files ?? [];
      const unexpected = paths.filter((path) => !packagePathAllowed(path, allowed));
      checks.push({
        id: `release.pack:${label}`,
        state: paths.length > 0 && unexpected.length === 0 ? 'passed' : 'failed',
        details:
          paths.length === 0
            ? 'The package dry run returned no files.'
            : unexpected.length === 0
              ? `Inspected ${paths.length} packed files.`
              : `Unexpected packed files: ${unexpected.join(', ')}`,
      });
    } catch {
      checks.push({
        id: `release.pack:${label}`,
        state: 'unknown',
        details: 'The package dry-run output was not valid JSON.',
      });
    }
  }

  const states = new Set(checks.map(({ state }) => state));
  return {
    strategy,
    state: states.has('failed') ? 'failed' : states.has('unknown') ? 'unknown' : 'passed',
    checks,
  };
}
