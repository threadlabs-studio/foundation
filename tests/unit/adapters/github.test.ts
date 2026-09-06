import { describe, expect, it } from 'vitest';

import { normalizeGithubFailure } from '../../../src/adapters/github.js';

describe('GitHub adapter failures', () => {
  it.each([
    [undefined, 'unavailable'],
    [401, 'unavailable'],
    [403, 'forbidden'],
    [429, 'rate-limited'],
    [500, 'invalid'],
  ] as const)('normalizes status %s as %s', (status, state) => {
    expect(normalizeGithubFailure(status)).toBe(state);
  });
});
