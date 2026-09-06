import { describe, expect, it } from 'vitest';

import {
  EXIT_CODES,
  validateConfig,
  validateManagedPath,
  validateModule,
  type ThreadlabsConfig,
} from '../../../src/index.js';

const minimalConfig: ThreadlabsConfig = {
  schemaVersion: '1.0',
  standardVersion: '1.0.0',
  bundles: ['typescript-library'],
  modules: [],
  exceptions: [],
  ownership: [],
};

describe('manifest contract', () => {
  it('accepts a minimal manifest and every ownership state', () => {
    expect(validateConfig(minimalConfig)).toEqual([]);
    expect(
      validateConfig({
        ...minimalConfig,
        ownership: ['managed', 'section-managed', 'local', 'unmanaged', 'ambiguous'].map(
          (mode, index) => ({
            path: `docs/${index}.md`,
            mode: mode as never,
            ...(mode === 'section-managed'
              ? { anchors: ['<!-- threadlabs:start -->', '<!-- threadlabs:end -->'] as const }
              : {}),
          }),
        ),
      }),
    ).toEqual([]);
  });

  it('rejects duplicate selections, unsupported schema majors, and malformed exceptions', () => {
    const issues = validateConfig({
      ...minimalConfig,
      schemaVersion: '2.0',
      modules: ['core', 'core'],
      exceptions: [
        { controlId: 'core.branch', reason: '', owner: '', scope: '', reviewDate: 'tomorrow' },
      ],
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'unsupported_schema',
        'duplicate_id',
        'required',
        'invalid_review_date',
      ]),
    );
  });

  it('rejects duplicate ownership paths and unknown release strategies', () => {
    const issues = validateConfig({
      ...minimalConfig,
      ownership: [
        { path: 'README.md', mode: 'local' },
        { path: 'README.md', mode: 'managed' },
      ],
      release: { strategy: 'guess' },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate_id', path: '/ownership/1/path' }),
        expect.objectContaining({ code: 'invalid_type', path: '/release/strategy' }),
      ]),
    );
  });

  it('requires reviewable metadata for intentionally held packages', () => {
    const issues = validateConfig({
      ...minimalConfig,
      freshness: {
        holds: [
          { name: '@types/node', reason: '', owner: '', reviewDate: 'eventually' },
          {
            name: '@types/node',
            reason: 'Duplicate synthetic hold.',
            owner: 'Example owner',
            reviewDate: '2027-01-31',
          },
        ],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'required', path: '/freshness/holds/0/reason' }),
        expect.objectContaining({ code: 'required', path: '/freshness/holds/0/owner' }),
        expect.objectContaining({ code: 'invalid_review_date' }),
        expect.objectContaining({ code: 'duplicate_id' }),
      ]),
    );
  });

  it('rejects properties the published schema does not define', () => {
    expect(
      validateConfig({
        ...minimalConfig,
        accidental: true,
        release: { strategy: 'single-package', surprise: true },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unknown_property', path: '/accidental' }),
        expect.objectContaining({ code: 'unknown_property', path: '/release/surprise' }),
      ]),
    );
  });
});

describe('managed paths', () => {
  it.each(['README.md', '.github/workflows/ci.yml', 'docs/standard.md'])('accepts %s', (path) =>
    expect(validateManagedPath(path)).toEqual([]),
  );

  it.each(['/tmp/file', '../secret', 'docs/../../secret', '.git/config', 'docs\\file.md', ''])(
    'rejects %s',
    (path) => expect(validateManagedPath(path).length).toBeGreaterThan(0),
  );
});

describe('module and exit contracts', () => {
  it('rejects duplicate controls and undeclared dependencies', () => {
    const issues = validateModule(
      {
        contractVersion: '1.0',
        id: 'example',
        version: '1.0.0',
        title: 'Example',
        description: 'Example module',
        dependencies: ['missing'],
        conflicts: [],
        capabilities: ['local-files'],
        controls: [
          {
            id: 'example.same',
            title: 'Same',
            failureClass: 'drift',
            applicability: 'always',
            lane: 'inner',
            determinism: 'deterministic',
            cost: { expectedSeconds: 1, humanEffort: 'low' },
            cheaperAlternatives: ['none'],
            retirementCondition: 'The failure class disappears.',
          },
          {
            id: 'example.same',
            title: 'Same again',
            failureClass: 'drift',
            applicability: 'always',
            lane: 'inner',
            determinism: 'deterministic',
            cost: { expectedSeconds: 1, humanEffort: 'low' },
            cheaperAlternatives: ['none'],
            retirementCondition: 'The failure class disappears.',
          },
        ],
        artifacts: [],
        stages: [],
      },
      new Set(['core']),
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate_id', 'unknown_dependency']),
    );
  });

  it('keeps stable exit classes distinct', () => {
    expect(EXIT_CODES).toEqual({
      success: 0,
      findings: 1,
      invalidInput: 2,
      staleOrConflict: 3,
      unavailableEvidence: 4,
      canceled: 5,
      mutationFailed: 6,
    });
  });
});
