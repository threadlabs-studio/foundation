import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { applyOperationPlan } from '../../../src/engine/apply.js';
import { createOperationPlan } from '../../../src/engine/plan.js';
import { contextFromConfig, loadConfig, loadLock } from '../../../src/commands/context.js';
import { makeConfig } from '../../utils/config.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('safe apply', () => {
  it('requires the exact approved digest', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-apply-'));
    roots.push(root);
    const planned = createOperationPlan(root, makeConfig(), {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    });
    expect(() => applyOperationPlan(root, planned.plan, 'wrong')).toThrow(/digest/iu);
  });

  it('rejects target or preimage drift before writing', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-apply-'));
    roots.push(root);
    const planned = createOperationPlan(root, makeConfig(), {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    });
    writeFileSync(join(root, 'README.md'), '# Appeared after preview\n');
    expect(() => applyOperationPlan(root, planned.plan, planned.digest)).toThrow(/preimage/iu);
  });

  it('rejects a symlink swap before any effect is written', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-apply-'));
    const outside = mkdtempSync(join(tmpdir(), 'threadlabs-outside-'));
    roots.push(root, outside);
    const planned = createOperationPlan(root, makeConfig(), {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    });
    writeFileSync(join(outside, 'README.md'), '# Outside\n');
    symlinkSync(join(outside, 'README.md'), join(root, 'README.md'));
    expect(() => applyOperationPlan(root, planned.plan, planned.digest)).toThrow(/symlink/iu);
    expect(existsSync(join(root, '.gitignore'))).toBe(false);
  });

  it('rejects a renamed physical target root', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-apply-'));
    const moved = `${root}-moved`;
    roots.push(moved);
    const planned = createOperationPlan(root, makeConfig(), {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    });
    renameSync(root, moved);
    expect(() => applyOperationPlan(moved, planned.plan, planned.digest)).toThrow(/fingerprint/iu);
    expect(existsSync(join(moved, '.gitignore'))).toBe(false);
  });

  it('rejects a manifest changed after a no-op preview', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-apply-'));
    roots.push(root);
    const initial = createOperationPlan(root, makeConfig(), {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    });
    applyOperationPlan(root, initial.plan, initial.digest);
    const config = loadConfig(root)!;
    const planned = createOperationPlan(
      root,
      config,
      contextFromConfig(config),
      'all',
      loadLock(root),
    );
    const manifestPath = join(root, 'threadlabs.config.json');
    const changed = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    changed.settings = { projectName: 'changed-after-preview' };
    writeFileSync(manifestPath, JSON.stringify(changed));

    expect(() => applyOperationPlan(root, planned.plan, planned.digest)).toThrow(/manifest/iu);
  });

  it('accepts the bound manifest preimage when the reviewed plan updates it', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-apply-'));
    roots.push(root);
    const initial = createOperationPlan(root, makeConfig(), {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    });
    applyOperationPlan(root, initial.plan, initial.digest);
    const current = loadConfig(root)!;
    const updated = {
      ...current,
      settings: { ...current.settings, description: 'A deliberately revised description.' },
    };
    const planned = createOperationPlan(
      root,
      updated,
      contextFromConfig(updated),
      'upgrade',
      loadLock(root),
    );

    expect(planned.plan.localEffects.map(({ path }) => path)).toContain('threadlabs.config.json');
    expect(() => applyOperationPlan(root, planned.plan, planned.digest)).not.toThrow();
    expect(loadConfig(root)?.settings?.description).toBe('A deliberately revised description.');
  });
});
