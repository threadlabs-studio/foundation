import { existsSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { applyOperationPlan } from '../../../src/engine/apply.js';
import { createOperationPlan } from '../../../src/engine/plan.js';
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
});
