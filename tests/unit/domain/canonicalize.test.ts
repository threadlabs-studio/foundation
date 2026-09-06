import { describe, expect, it } from 'vitest';

import { canonicalJson, digestCanonical } from '../../../src/domain/canonicalize.js';

describe('canonical serialization', () => {
  it('produces identical bytes and digests for semantically equivalent input', () => {
    const first = {
      modules: ['typescript', 'core'],
      policy: { z: true, a: 1 },
      exceptions: [
        { controlId: 'b', reason: 'B' },
        { reason: 'A', controlId: 'a' },
      ],
    };
    const second = {
      exceptions: [
        { controlId: 'a', reason: 'A' },
        { controlId: 'b', reason: 'B' },
      ],
      policy: { a: 1, z: true },
      modules: ['core', 'typescript'],
    };

    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(digestCanonical(first)).toBe(digestCanonical(second));
  });

  it('preserves ordered operation effects', () => {
    const value = { localEffects: [{ id: 'second' }, { id: 'first' }] };
    expect(
      JSON.parse(canonicalJson(value)).localEffects.map((item: { id: string }) => item.id),
    ).toEqual(['second', 'first']);
  });
});
