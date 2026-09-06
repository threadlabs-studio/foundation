import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runBoundedCommand } from '../adapters/command-runner.js';
import { compareText } from '../domain/canonicalize.js';
import { classifyFreshness, type FreshnessResult } from '../engine/freshness.js';
import type { CommandOptions, CommandResult } from './types.js';

export function freshnessCommand(options: CommandOptions): CommandResult {
  const manifest = JSON.parse(readFileSync(join(options.root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const declared = { ...manifest.dependencies, ...manifest.devDependencies };
  let outdated: Record<string, { current?: string; wanted?: string; latest?: string }> = {};
  let sourceFailed = options.values.offline === true;
  if (!sourceFailed) {
    const result = runBoundedCommand('npm', ['outdated', '--json'], options.root, {
      timeoutMs: 60_000,
    });
    try {
      outdated = result.stdout.trim().length === 0 ? {} : JSON.parse(result.stdout);
      sourceFailed = result.status !== 0 && result.status !== 1;
    } catch {
      sourceFailed = true;
    }
  }
  const results: Array<{ readonly name: string; readonly result: FreshnessResult }> =
    Object.entries(declared)
      .map(([name, current]) => {
        const observed = outdated[name];
        return {
          name,
          result: classifyFreshness({
            current: observed?.current ?? current,
            ...(observed?.latest === undefined ? {} : { latest: observed.latest }),
            ...(sourceFailed
              ? { failed: true }
              : observed === undefined
                ? { latest: current }
                : {}),
          }),
        };
      })
      .toSorted((left, right) => compareText(left.name, right.name));
  const actionable = results.some(({ result }) => result.state !== 'current');
  return {
    command: 'freshness',
    status: actionable ? 'findings' : 'success',
    exitClass: sourceFailed ? 'unavailableEvidence' : actionable ? 'findings' : 'success',
    summary: sourceFailed
      ? 'Freshness evidence is unavailable; declared versions remain visible but are not claimed current.'
      : actionable
        ? 'Dependency updates or review states are available.'
        : 'Declared dependencies are current.',
    data: { source: sourceFailed ? 'unavailable' : 'npm', results },
  };
}
