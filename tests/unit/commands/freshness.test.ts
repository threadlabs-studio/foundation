import { describe, expect, it } from 'vitest';

import { nodeMajorsInRange } from '../../../src/commands/freshness.js';

describe('Node engine range interpretation', () => {
  const releasedLines = [20, 21, 22, 23, 24, 25, 26];

  it('detects every released line promised by an open range', () => {
    expect(nodeMajorsInRange('>=22', releasedLines)).toEqual([22, 23, 24, 25, 26]);
  });

  it('keeps explicitly bounded LTS lines and rejects invalid ranges', () => {
    expect(nodeMajorsInRange('>=22.13 <23 || >=24 <25', releasedLines)).toEqual([22, 24]);
    expect(nodeMajorsInRange('whenever', releasedLines)).toBeUndefined();
  });
});
