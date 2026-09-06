import { describe, expect, it } from 'vitest';

import { normalizeNodeSchedule } from '../../../src/adapters/node-lifecycle.js';

describe('Node lifecycle evidence', () => {
  it('distinguishes active, maintenance, current, future, and EOL lines from published dates', () => {
    const lines = normalizeNodeSchedule(
      {
        v20: {
          start: '2023-01-01',
          lts: '2023-02-01',
          maintenance: '2024-01-01',
          end: '2025-01-01',
        },
        v22: {
          start: '2024-01-01',
          lts: '2024-02-01',
          maintenance: '2025-01-01',
          end: '2027-01-01',
        },
        v23: { start: '2025-01-01', lts: false, end: '2027-01-01' },
        v24: {
          start: '2025-01-01',
          lts: '2025-02-01',
          maintenance: '2027-01-01',
          end: '2028-01-01',
        },
        v26: { start: '2027-01-01', lts: '2027-02-01', end: '2030-01-01' },
      },
      new Date('2026-09-06T00:00:00Z'),
    );
    expect(lines).toEqual([
      { major: 20, status: 'eol' },
      { major: 22, status: 'maintenance-lts' },
      { major: 23, status: 'current' },
      { major: 24, status: 'active-lts' },
    ]);
  });
});
