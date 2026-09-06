import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createOperationPlan } from '../../../src/engine/plan.js';
import { applyOperationPlan } from '../../../src/engine/apply.js';
import type { ThreadlabsLock } from '../../../src/domain/config.js';
import { hashContent } from '../../../src/engine/fingerprint.js';
import { makeConfig } from '../../utils/config.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('operation planning', () => {
  it('previews deterministically without writing the target', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-plan-'));
    roots.push(root);
    const before = readdirSync(root);
    const first = createOperationPlan(root, makeConfig(), {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    });
    const second = createOperationPlan(root, makeConfig(), {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    });

    expect(first.digest).toBe(second.digest);
    expect(first.plan.localEffects.length).toBeGreaterThan(1);
    expect(readdirSync(root)).toEqual(before);
  });

  it('refuses to plan over ambiguous existing content', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-plan-'));
    roots.push(root);
    writeFileSync(join(root, 'README.md'), '# Custom\n');
    expect(() =>
      createOperationPlan(root, makeConfig(), {
        projectName: 'sample-library',
        description: 'A sample library.',
        licenseHolder: 'Sample Authors',
      }),
    ).toThrow(/ambiguous/iu);
  });

  it('leaves explicitly local artifacts alone', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-plan-'));
    roots.push(root);
    writeFileSync(join(root, 'README.md'), '# Purpose-built documentation\n');
    const config = {
      ...makeConfig(),
      ownership: [{ path: 'README.md', mode: 'local' as const }],
    };

    const planned = createOperationPlan(root, config, {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    });

    expect(planned.plan.localEffects.map(({ path }) => path)).not.toContain('README.md');
  });

  it('limits a named stage to that module while retaining manifest and lock effects', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-plan-'));
    roots.push(root);
    const planned = createOperationPlan(
      root,
      { ...makeConfig([]), bundles: ['typescript-library'] },
      {
        projectName: 'sample-library',
        description: 'A sample library.',
        licenseHolder: 'Sample Authors',
      },
      'core.install',
    );
    const paths = planned.plan.localEffects.map(({ path }) => path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '.gitignore',
        'LICENSE',
        'README.md',
        'threadlabs.config.json',
        '.threadlabs.lock.json',
      ]),
    );
    expect(paths).not.toContain('package.json');
  });

  it('retains earlier managed digests while adopting the next stage', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-plan-'));
    roots.push(root);
    const config = { ...makeConfig([]), bundles: ['typescript-library'] };
    const context = {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    };
    const first = createOperationPlan(root, config, context, 'core.install');
    applyOperationPlan(root, first.plan, first.digest);
    const firstLock = JSON.parse(
      readFileSync(join(root, '.threadlabs.lock.json'), 'utf8'),
    ) as ThreadlabsLock;
    const second = createOperationPlan(root, config, context, 'typescript-node.install', firstLock);
    const secondLockEffect = second.plan.localEffects.find(
      ({ path }) => path === '.threadlabs.lock.json',
    );
    const secondLock = JSON.parse(secondLockEffect?.content ?? '{}') as ThreadlabsLock;

    expect(second.plan.localEffects.map(({ path }) => path)).not.toContain('README.md');
    expect(second.plan.localEffects.map(({ path }) => path)).toContain('package.json');
    expect(secondLock.artifacts.README).toBeUndefined();
    expect(secondLock.artifacts['README.md']).toBe(firstLock.artifacts['README.md']);
  });

  it('accepts an authored manifest edit as reviewed plan input', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-plan-'));
    roots.push(root);
    const context = {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    };
    const initial = createOperationPlan(root, makeConfig(), context);
    applyOperationPlan(root, initial.plan, initial.digest);
    const manifestPath = join(root, 'threadlabs.config.json');
    const edited = {
      ...(JSON.parse(readFileSync(manifestPath, 'utf8')) as ReturnType<typeof makeConfig>),
      settings: { description: 'An authored manifest revision.' },
    };
    writeFileSync(manifestPath, JSON.stringify(edited));
    const lock = JSON.parse(
      readFileSync(join(root, '.threadlabs.lock.json'), 'utf8'),
    ) as ThreadlabsLock;

    const planned = createOperationPlan(
      root,
      edited,
      { ...context, description: 'An authored manifest revision.' },
      'all',
      lock,
    );
    expect(planned.plan.localEffects.map(({ path }) => path)).toContain('threadlabs.config.json');
  });

  it('updates only an anchored managed section and preserves surrounding content', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-plan-'));
    roots.push(root);
    const start = '<!-- threadlabs:start -->';
    const end = '<!-- threadlabs:end -->';
    const existing = `# Local heading\n${start}\nOld generated text\n${end}\nLocal footer\n`;
    writeFileSync(join(root, 'README.md'), existing);
    const config = {
      ...makeConfig(),
      ownership: [
        { path: 'README.md', mode: 'section-managed' as const, anchors: [start, end] as const },
      ],
    };
    const planned = createOperationPlan(
      root,
      config,
      {
        projectName: 'sample-library',
        description: 'A sample library.',
        licenseHolder: 'Sample Authors',
      },
      'all',
      {
        schemaVersion: '1.0',
        standardVersion: '1.0.0',
        modules: { core: '1.0.0' },
        artifacts: { 'README.md': hashContent('\nOld generated text\n') },
      },
    );
    const readme = planned.plan.localEffects.find(({ path }) => path === 'README.md');
    expect(readme?.content).toMatch(/^# Local heading\n/);
    expect(readme?.content).toMatch(/Local footer\n$/);
    expect(readme?.content).toContain('A sample library.');
  });
});
