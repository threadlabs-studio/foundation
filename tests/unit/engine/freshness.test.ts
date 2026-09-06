import { describe, expect, it } from 'vitest';

import { classifyFreshness } from '../../../src/engine/freshness.js';

describe('freshness classification', () => {
  it.each([
    [{ current: '1.0.0', latest: '1.0.0' }, 'current'],
    [{ current: '1.0.0', latest: '1.1.0' }, 'update-available'],
    [{ current: '1.0.0', latest: '2.0.0' }, 'major-update'],
    [{ current: '1.0.0-alpha.1', latest: '1.0.0' }, 'prerelease'],
    [{ current: '1.0.0', latest: '1.1.0', heldReason: 'Compatibility' }, 'intentionally-held'],
    [{ current: '1.0.0', latest: '1.1.0', securityBlocked: true }, 'security-blocked'],
    [{ current: '1.0.0', latest: '1.0.0', eol: true }, 'eol'],
    [{ current: '1.0.0', failed: true }, 'update-failed'],
    [{ current: '1.0.0', stale: true }, 'stale'],
    [{ current: '1.0.0' }, 'unknown'],
  ] as const)('classifies %j as %s', (input, expected) => {
    expect(classifyFreshness(input).state).toBe(expected);
  });
});
