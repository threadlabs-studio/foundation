import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { applyOperationPlan } from '../../src/engine/apply.js';
import { auditRepository } from '../../src/engine/audit.js';
import { createOperationPlan } from '../../src/engine/plan.js';
import { contextFromConfig, loadConfig, loadLock } from '../../src/commands/context.js';
import { makeConfig } from '../utils/config.js';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const root of temporaryDirectories.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('Foundation dogfood', () => {
  it('self-audits without actionable findings or timestamp-only plan drift', () => {
    const config = loadConfig(repositoryRoot);
    const lock = loadLock(repositoryRoot);
    expect(config).toBeDefined();
    expect(lock).toBeDefined();
    const report = auditRepository(repositoryRoot, { config: config!, lock: lock! });
    expect(
      report.findings.filter(({ state }) => state !== 'conformant' && state !== 'exception'),
    ).toEqual([]);

    const first = createOperationPlan(
      repositoryRoot,
      config!,
      contextFromConfig(config!),
      'all',
      lock,
    );
    const second = createOperationPlan(
      repositoryRoot,
      config!,
      contextFromConfig(config!),
      'all',
      lock,
    );
    expect(first.plan.localEffects).toEqual([]);
    expect(second.digest).toBe(first.digest);
  });

  it('takes an empty TypeScript library from selection to an idempotent first baseline', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-first-green-'));
    temporaryDirectories.push(root);
    const config = {
      ...makeConfig([]),
      bundles: ['typescript-library'],
      release: { strategy: 'single-package' as const },
      settings: {
        projectName: 'example-library',
        description: 'A synthetic public library.',
        licenseHolder: 'Example Contributors',
        licenseYear: 2026,
      },
    };
    const planned = createOperationPlan(root, config, contextFromConfig(config));
    expect(planned.plan.localEffects.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        'package.json',
        'AGENTS.md',
        'CLAUDE.md',
        '.github/workflows/ci.yml',
        '.github/workflows/release.yml',
        '.github/dependabot.yml',
      ]),
    );
    applyOperationPlan(root, planned.plan, planned.digest);

    const installedConfig = loadConfig(root)!;
    const installedLock = loadLock(root)!;
    const repeated = createOperationPlan(
      root,
      installedConfig,
      contextFromConfig(installedConfig),
      'all',
      installedLock,
    );
    expect(repeated.plan.localEffects).toEqual([]);
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts['verify:pr']).toBeDefined();
    expect(manifest.scripts['verify:release']).toContain('pack --dry-run');
  });
});
