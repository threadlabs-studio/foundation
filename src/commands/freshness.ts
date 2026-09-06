import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { intersects, validRange } from 'semver';

import { runBoundedCommand } from '../adapters/command-runner.js';
import { observeNodeLifecycle } from '../adapters/node-lifecycle.js';
import { compareText } from '../domain/canonicalize.js';
import { classifyFreshness, type FreshnessResult } from '../engine/freshness.js';
import { loadConfig } from './context.js';
import type { CommandOptions, CommandResult } from './types.js';

export function nodeMajorsInRange(
  range: string,
  candidateMajors: readonly number[],
): readonly number[] | undefined {
  if (validRange(range, { loose: true }) === null) return undefined;
  try {
    return candidateMajors.filter((major) =>
      intersects(range, `>=${major}.0.0 <${major + 1}.0.0`, {
        loose: true,
      }),
    );
  } catch {
    return undefined;
  }
}

export function freshnessCommand(options: CommandOptions): CommandResult {
  const manifest = JSON.parse(readFileSync(join(options.root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    engines?: { node?: string };
    devEngines?: { runtime?: { version?: string } };
  };
  const declared = { ...manifest.dependencies, ...manifest.devDependencies };
  const holds = new Map(
    (loadConfig(options.root)?.freshness?.holds ?? []).map((hold) => [hold.name, hold]),
  );
  const today = new Date().toISOString().slice(0, 10);
  const latestVersions = new Map<string, string>();
  const failedPackages = new Set<string>();
  for (const name of Object.keys(declared).toSorted(compareText)) {
    if (options.values.offline === true) {
      failedPackages.add(name);
      continue;
    }
    const observed = runBoundedCommand(
      'npm',
      ['view', `${name}@latest`, 'version', '--json'],
      options.root,
      { timeoutMs: 5_000 },
    );
    try {
      const version = JSON.parse(observed.stdout) as unknown;
      if (observed.state !== 'passed' || typeof version !== 'string') failedPackages.add(name);
      else latestVersions.set(name, version);
    } catch {
      failedPackages.add(name);
    }
  }
  const sourceFailed = failedPackages.size > 0;
  const results: Array<{
    readonly name: string;
    readonly result: FreshnessResult;
    readonly hold?: { readonly owner: string; readonly reviewDate: string };
  }> = Object.entries(declared)
    .map(([name, current]) => {
      const latest = latestVersions.get(name);
      const hold = holds.get(name);
      return {
        name,
        result: classifyFreshness({
          current,
          ...(latest === undefined ? {} : { latest }),
          ...(hold === undefined ? {} : { heldReason: hold.reason }),
          ...(hold !== undefined && hold.reviewDate < today ? { stale: true } : {}),
          ...(failedPackages.has(name) ? { failed: true } : {}),
        }),
        ...(hold === undefined ? {} : { hold: { owner: hold.owner, reviewDate: hold.reviewDate } }),
      };
    })
    .toSorted((left, right) => compareText(left.name, right.name));
  const actionable = results.some(
    ({ result }) => result.state !== 'current' && result.state !== 'intentionally-held',
  );
  const nodeRange = manifest.engines?.node;
  const developmentRange = manifest.devEngines?.runtime?.version;
  const runtimeRelevant = nodeRange !== undefined || developmentRange !== undefined;
  const runtimeLifecycle =
    options.values.offline === true || !runtimeRelevant
      ? {
          source: 'nodejs/Release schedule' as const,
          observedAt: new Date().toISOString(),
          state: 'unavailable' as const,
          lines: [],
          details:
            options.values.offline === true
              ? 'Offline mode was requested.'
              : 'No Node runtime range is declared.',
        }
      : observeNodeLifecycle(options.root);
  const candidateMajors = runtimeLifecycle.lines.map(({ major }) => major);
  const promisedMajors =
    nodeRange === undefined ? [] : nodeMajorsInRange(nodeRange, candidateMajors);
  const developmentMajor =
    developmentRange === undefined
      ? undefined
      : nodeMajorsInRange(developmentRange, candidateMajors)?.at(-1);
  const activeMajor = runtimeLifecycle.lines
    .filter(({ status }) => status === 'active-lts')
    .map(({ major }) => major)
    .at(-1);
  const runtimes =
    runtimeLifecycle.state === 'unavailable' && runtimeRelevant
      ? [
          {
            name: 'node engine',
            lifecycle: 'unknown',
            result: classifyFreshness({ current: nodeRange ?? developmentRange!, failed: true }),
          },
        ]
      : promisedMajors === undefined ||
          (nodeRange !== undefined && promisedMajors.length === 0) ||
          (developmentRange !== undefined && developmentMajor === undefined)
        ? [
            {
              name: 'node engine',
              lifecycle: 'invalid-range',
              result: classifyFreshness({
                current: nodeRange ?? developmentRange!,
                failed: true,
              }),
            },
          ]
        : [...new Set(promisedMajors)].map((major) => {
            const lifecycle = runtimeLifecycle.lines.find((line) => line.major === major)?.status;
            const result = classifyFreshness({
              current: String(major),
              ...(lifecycle === 'eol'
                ? { eol: true }
                : lifecycle === undefined
                  ? {}
                  : (lifecycle === 'current' ||
                        (major === developmentMajor && lifecycle !== 'active-lts')) &&
                      activeMajor !== undefined
                    ? { latest: String(activeMajor) }
                    : { latest: String(major) }),
            });
            return { name: `node@${major}`, lifecycle: lifecycle ?? 'unknown', result };
          });
  const runtimeActionable = runtimes.some(({ result }) => result.state !== 'current');
  const unavailable = sourceFailed || (runtimeRelevant && runtimeLifecycle.state === 'unavailable');
  return {
    command: 'freshness',
    status: actionable || runtimeActionable ? 'findings' : 'success',
    exitClass: unavailable
      ? 'unavailableEvidence'
      : actionable || runtimeActionable
        ? 'findings'
        : 'success',
    summary: unavailable
      ? 'Some freshness evidence is unavailable; declared versions remain visible but are not claimed current.'
      : actionable || runtimeActionable
        ? 'Dependency updates or review states are available.'
        : 'Declared dependencies are current.',
    data: {
      source: sourceFailed ? 'unavailable' : 'npm',
      results,
      runtimeLifecycle,
      runtimes,
    },
  };
}
