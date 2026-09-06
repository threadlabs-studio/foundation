import { describe, expect, it } from 'vitest';

import { loadDeclarativeModule } from '../../src/modules/contracts.js';

const moduleFixture = {
  contractVersion: '1.0',
  id: 'example-addon',
  version: '1.0.0',
  title: 'Example addon',
  description: 'Synthetic declarative extension.',
  dependencies: ['core'],
  conflicts: [],
  capabilities: ['local-files'],
  controls: [
    {
      id: 'example-addon.check',
      title: 'Check example',
      failureClass: 'configuration-drift',
      applicability: 'Selected explicitly.',
      lane: 'inner',
      determinism: 'deterministic',
      cost: { expectedSeconds: 1, humanEffort: 'low' },
      cheaperAlternatives: ['Manual inspection.'],
      retirementCondition: 'The configured artifact is removed.',
    },
  ],
  artifacts: [{ path: 'example.txt', ownership: 'managed', template: 'example-content' }],
  stages: [
    {
      id: 'example-addon.install',
      title: 'Install example',
      description: 'Creates the example artifact.',
      artifactPaths: ['example.txt'],
      controlIds: ['example-addon.check'],
    },
  ],
};

describe('declarative extension boundary', () => {
  it('loads an explicitly supplied data-only module', () => {
    expect(loadDeclarativeModule(moduleFixture, new Set(['core'])).id).toBe('example-addon');
  });

  it.each([
    [{ ...moduleFixture, entrypoint: './run.js' }, /unknown field.*entrypoint/iu],
    [{ ...moduleFixture, contractVersion: '2.0' }, /contract major/iu],
    [{ ...moduleFixture, capabilities: ['process-execution'] }, /capability/iu],
    [{ ...moduleFixture, dependencies: ['missing'] }, /dependency/iu],
  ])('rejects executable, incompatible, or over-capable input', (fixture, message) => {
    expect(() => loadDeclarativeModule(fixture, new Set(['core']))).toThrow(message);
  });
});
