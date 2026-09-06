import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createOperationPlan } from '../../../src/engine/plan.js';
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
});
