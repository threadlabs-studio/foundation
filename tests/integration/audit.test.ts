import { existsSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { auditRepository } from '../../src/engine/audit.js';

const roots: string[] = [];

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe('repository audit integration', () => {
  it('does not write while auditing an empty repository', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-audit-'));
    roots.push(root);
    const before = readdirSync(root);
    const report = auditRepository(root);
    expect(report.mode).toBe('new');
    expect(existsSync(join(root, 'threadlabs.config.json'))).toBe(false);
    expect(readdirSync(root)).toEqual(before);
  });

  it('blocks managed-path symlinks before planning', () => {
    const root = mkdtempSync(join(tmpdir(), 'threadlabs-audit-'));
    const outside = mkdtempSync(join(tmpdir(), 'threadlabs-outside-'));
    roots.push(root, outside);
    writeFileSync(join(outside, 'README.md'), 'outside');
    symlinkSync(join(outside, 'README.md'), join(root, 'README.md'));
    expect(() => auditRepository(root)).toThrow(/symlink/iu);
  });
});
