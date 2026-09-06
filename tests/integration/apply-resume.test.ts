import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { applyOperationPlan } from '../../src/engine/apply.js';
import { createOperationPlan } from '../../src/engine/plan.js';
import { makeConfig } from '../utils/config.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('journaled apply and resume', () => {
  it('resumes after interruption without repeating a completed effect', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-resume-'));
    roots.push(root);
    const planned = createOperationPlan(root, makeConfig(), {
      projectName: 'sample-library',
      description: 'A sample library.',
      licenseHolder: 'Sample Authors',
    });

    expect(() =>
      applyOperationPlan(root, planned.plan, planned.digest, {
        afterEffect: (_effect, completed) => {
          if (completed === 1) throw new Error('synthetic interruption');
        },
      }),
    ).toThrow(/synthetic interruption/u);

    const resumed = applyOperationPlan(root, planned.plan, planned.digest);
    expect(resumed.state).toBe('succeeded');
    expect(resumed.resumedEffects).toBe(1);
    expect(existsSync(join(root, 'threadlabs.config.json'))).toBe(true);
    expect(existsSync(join(root, '.threadlabs.lock.json'))).toBe(true);

    const journalPath = join(root, '.threadlabs', 'operations', `${planned.digest}.jsonl`);
    const journal = readFileSync(journalPath, 'utf8');
    const reapplied = applyOperationPlan(root, planned.plan, planned.digest);
    expect(reapplied.state).toBe('no-op');
    expect(readFileSync(journalPath, 'utf8')).toBe(journal);
  });
});
