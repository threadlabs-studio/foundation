import { describe, expect, it } from 'vitest';

import type { RepositorySnapshot } from '../../../src/adapters/filesystem.js';
import type { CodeDocumentationConfig } from '../../../src/domain/config.js';
import { auditCodeDocumentation } from '../../../src/engine/code-documentation.js';

function snapshot(files: Readonly<Record<string, string>>): RepositorySnapshot {
  return { files: new Map(Object.entries(files)), symlinks: [], caseCollisions: [] };
}

const documentation: CodeDocumentationConfig = {
  hotspots: [
    {
      id: 'queue-ordering',
      source: 'src/queue.ts',
      symbol: 'drainQueue',
      dimensions: ['invariant', 'algorithm', 'performance'],
      documentation: 'docs/architecture.md#queue-ordering',
      tests: ['tests/queue.test.ts'],
    },
  ],
};

describe('code documentation audit', () => {
  it('accepts a linked hotspot with every declared dimension and evidence path', () => {
    const findings = auditCodeDocumentation(
      snapshot({
        'src/queue.ts': `/**\n * Drains producers in stable order.\n * @docs queue-ordering\n */\nexport function drainQueue() {}\n`,
        'docs/architecture.md': `# Architecture\n\n## Queue ordering\n\n### Invariant\nStable IDs break ties.\n\n### Algorithm\nThe queue uses a heap.\n\n### Performance\nInsertion is logarithmic.\n\n### Verification\nSee the queue tests.\n`,
        'tests/queue.test.ts': 'export {};\n',
      }),
      documentation,
    );

    expect(findings).toEqual([
      expect.objectContaining({
        controlId: 'code-documentation.baseline',
        state: 'conformant',
        evidence: expect.arrayContaining(['hotspot:queue-ordering']),
      }),
    ]);
  });

  it('reports missing markers, symbols, anchors, and tests without scoring prose', () => {
    const findings = auditCodeDocumentation(
      snapshot({
        'src/queue.ts': 'export function other() {}\n',
        'docs/architecture.md': '# Architecture\n\n## Different heading\n',
      }),
      documentation,
    );

    expect(findings).toEqual([
      expect.objectContaining({
        state: 'gap',
        evidence: expect.arrayContaining([
          'missing-symbol:src/queue.ts#drainQueue',
          'missing-marker:src/queue.ts#queue-ordering',
          'missing-anchor:docs/architecture.md#queue-ordering',
          'missing-test:tests/queue.test.ts',
        ]),
      }),
    ]);
  });

  it('reports every missing declared dimension and verification heading', () => {
    const findings = auditCodeDocumentation(
      snapshot({
        'src/queue.ts': '/** @docs queue-ordering */\nexport function drainQueue() {}\n',
        'docs/architecture.md': '## Queue ordering\n\n### Invariant\nStable.\n',
        'tests/queue.test.ts': 'export {};\n',
      }),
      documentation,
    );

    expect(findings).toEqual([
      expect.objectContaining({
        state: 'gap',
        evidence: expect.arrayContaining([
          'missing-dimension:docs/architecture.md#queue-ordering:algorithm',
          'missing-dimension:docs/architecture.md#queue-ordering:performance',
          'missing-verification:docs/architecture.md#queue-ordering',
        ]),
      }),
    ]);
  });

  it('requires a documentation map only after the module is selected', () => {
    expect(auditCodeDocumentation(snapshot({}), undefined)).toEqual([
      expect.objectContaining({ state: 'gap', title: 'Documentation hotspot map is missing' }),
    ]);
    expect(auditCodeDocumentation(snapshot({}), { hotspots: [] })).toEqual([
      expect.objectContaining({ state: 'conformant', evidence: ['hotspots:0'] }),
    ]);
  });
});
