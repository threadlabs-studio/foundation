import { describe, expect, it } from 'vitest';

import { auditSnapshot } from '../../../src/engine/audit.js';
import { hashContent } from '../../../src/engine/fingerprint.js';
import { makeConfig } from '../../utils/config.js';

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

  it('reports an explicitly local artifact as an intentional exception', () => {
    const config = {
      ...makeConfig(),
      ownership: [{ path: 'README.md', mode: 'local' as const }],
    };
    const report = auditSnapshot(
      {
        files: new Map([
          ['README.md', '# Local documentation\n'],
          ['LICENSE', 'Local license\n'],
          ['.gitignore', 'dist/\n'],
        ]),
        symlinks: [],
        caseCollisions: [],
      },
      { config },
    );

    expect(report.findings).toContainEqual(
      expect.objectContaining({ title: 'README.md is locally owned', state: 'exception' }),
    );
  });

  it('surfaces reviewed control exceptions without making the audit actionable', () => {
    const report = auditSnapshot(
      { files: new Map(), symlinks: [], caseCollisions: [] },
      {
        config: {
          ...makeConfig([]),
          modules: [],
          exceptions: [
            {
              controlId: 'core.baseline',
              reason: 'Synthetic temporary constraint.',
              owner: 'Example owner',
              scope: 'Synthetic fixture',
              reviewDate: '2027-01-01',
            },
          ],
        },
      },
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ controlId: 'core.baseline', state: 'exception' }),
    );
  });

  it('checks only the owned section while allowing local surrounding edits', () => {
    const start = '<!-- threadlabs:start -->';
    const end = '<!-- threadlabs:end -->';
    const config = {
      ...makeConfig(),
      ownership: [
        { path: 'README.md', mode: 'section-managed' as const, anchors: [start, end] as const },
        { path: '.gitignore', mode: 'local' as const },
        { path: 'LICENSE', mode: 'local' as const },
      ],
    };
    const report = auditSnapshot(
      {
        files: new Map([
          ['README.md', `Changed local heading\n${start}\nManaged\n${end}\n`],
          ['.gitignore', 'Local\n'],
          ['LICENSE', 'Local\n'],
        ]),
        symlinks: [],
        caseCollisions: [],
      },
      {
        config,
        lock: {
          schemaVersion: '1.0',
          standardVersion: '1.0.0',
          modules: { core: '1.0.0' },
          artifacts: { 'README.md': hashContent('\nManaged\n') },
        },
      },
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ title: 'README.md matches', state: 'conformant' }),
    );
  });
});
