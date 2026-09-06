import { describe, expect, it } from 'vitest';

import { auditSnapshot } from '../../../src/engine/audit.js';

describe('audit engine', () => {
  it('recommends a first-green TypeScript baseline for an empty repository', () => {
    const report = auditSnapshot({ files: new Map(), symlinks: [], caseCollisions: [] });
    expect(report.mode).toBe('new');
    expect(report.suggestedModules).toContain('typescript-node');
    expect(report.suggestedModules).not.toContain('performance');
    expect(report.findings.some((finding) => finding.state === 'gap')).toBe(true);
  });

  it('treats an existing custom workflow as ambiguous instead of proposing overwrite', () => {
    const report = auditSnapshot({
      files: new Map([
        ['package.json', '{"type":"module","devDependencies":{"typescript":"7.0.2"}}'],
        ['.github/workflows/ci.yml', 'name: Custom\n'],
      ]),
      symlinks: [],
      caseCollisions: [],
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({ controlId: 'github.baseline', state: 'unknown' }),
    );
    expect(report.stages.flatMap((stage) => stage.blockedPaths)).toContain(
      '.github/workflows/ci.yml',
    );
  });

  it.each(['unavailable', 'forbidden', 'rate-limited', 'stale', 'invalid'] as const)(
    'preserves %s external evidence as unknown',
    (state) => {
      const report = auditSnapshot(
        { files: new Map(), symlinks: [], caseCollisions: [] },
        {
          externalEvidence: [{ source: 'github', observedAt: '2026-09-06T00:00:00Z', state }],
        },
      );
      expect(report.observations).toContainEqual(
        expect.objectContaining({ source: 'github', state: 'unknown' }),
      );
    },
  );

  it('reports case collisions and over-budget checks without deleting controls', () => {
    const report = auditSnapshot(
      { files: new Map(), symlinks: [], caseCollisions: [['README.md', 'readme.md']] },
      { observedDurations: { 'typescript-node.baseline': 400_000 } },
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ controlId: 'core.path-safety', state: 'unknown' }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        controlId: 'typescript-node.baseline',
        explanation: expect.stringMatching(/budget/iu),
      }),
    );
  });
});
