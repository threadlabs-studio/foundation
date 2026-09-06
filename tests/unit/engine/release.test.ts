import { describe, expect, it } from 'vitest';

import {
  planPublicationResume,
  releaseArtifacts,
  RELEASE_STRATEGIES,
} from '../../../src/engine/release.js';

describe('release strategy planning', () => {
  it('models every supported release strategy explicitly', () => {
    expect(RELEASE_STRATEGIES).toEqual([
      'exceptional-multi-artifact',
      'fixed-monorepo',
      'independent-monorepo',
      'prerelease-channel',
      'single-package',
    ]);

    for (const strategy of RELEASE_STRATEGIES) {
      const artifacts = releaseArtifacts(strategy);
      expect(artifacts.map((artifact) => artifact.path)).toContain('.github/workflows/release.yml');
      expect(artifacts.map((artifact) => artifact.path)).toContain('scripts/release.mjs');
    }
  });

  it('adds Changesets only to strategies that need version coordination', () => {
    expect(
      releaseArtifacts('single-package').some(({ path }) => path.startsWith('.changeset/')),
    ).toBe(false);
    expect(
      releaseArtifacts('exceptional-multi-artifact').some(({ path }) =>
        path.startsWith('.changeset/'),
      ),
    ).toBe(false);

    for (const strategy of [
      'fixed-monorepo',
      'independent-monorepo',
      'prerelease-channel',
    ] as const) {
      expect(releaseArtifacts(strategy).map(({ path }) => path)).toContain(
        '.changeset/config.json',
      );
    }
  });
});

describe('publication recovery', () => {
  it('does not attempt to republish an immutable version after a source-host timeout', () => {
    expect(
      planPublicationResume({
        packageName: '@example/package',
        version: '1.2.3',
        expectedIntegrity: 'sha512-reviewed',
        registry: { state: 'published', integrity: 'sha512-reviewed' },
        sourceRelease: { state: 'unknown' },
      }),
    ).toEqual({
      state: 'blocked',
      actions: [],
      reason: 'Source release state is unknown; observe it again before resuming.',
    });

    expect(
      planPublicationResume({
        packageName: '@example/package',
        version: '1.2.3',
        expectedIntegrity: 'sha512-reviewed',
        registry: { state: 'published', integrity: 'sha512-reviewed' },
        sourceRelease: { state: 'missing' },
      }),
    ).toEqual({ state: 'ready', actions: ['create-source-release'] });
  });

  it('blocks immutable-version conflicts', () => {
    expect(
      planPublicationResume({
        packageName: '@example/package',
        version: '1.2.3',
        expectedIntegrity: 'sha512-reviewed',
        registry: { state: 'published', integrity: 'sha512-other' },
        sourceRelease: { state: 'missing' },
      }),
    ).toMatchObject({ state: 'blocked', actions: [] });
  });
});
