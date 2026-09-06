import { runBoundedCommand } from './command-runner.js';

export type NodeLifecycleStatus = 'active-lts' | 'maintenance-lts' | 'current' | 'eol';

export interface NodeLifecycleLine {
  readonly major: number;
  readonly status: NodeLifecycleStatus;
}

interface ScheduleEntry {
  readonly start: string;
  readonly lts: string | false;
  readonly maintenance?: string;
  readonly end: string;
}

export function normalizeNodeSchedule(
  schedule: Readonly<Record<string, ScheduleEntry>>,
  observedAt: Date,
): readonly NodeLifecycleLine[] {
  const now = observedAt.toISOString().slice(0, 10);
  return Object.entries(schedule)
    .flatMap(([line, entry]) => {
      const match = /^v(\d+)$/u.exec(line);
      if (match?.[1] === undefined || entry.start > now) return [];
      const major = Number(match[1]);
      const status: NodeLifecycleStatus =
        entry.end <= now
          ? 'eol'
          : entry.lts === false || entry.lts > now
            ? 'current'
            : entry.maintenance !== undefined && entry.maintenance <= now
              ? 'maintenance-lts'
              : 'active-lts';
      return [{ major, status }];
    })
    .toSorted((left, right) => left.major - right.major);
}

export interface NodeLifecycleObservation {
  readonly source: 'nodejs/Release schedule';
  readonly observedAt: string;
  readonly state: 'available' | 'unavailable';
  readonly lines: readonly NodeLifecycleLine[];
  readonly details?: string;
}

export function observeNodeLifecycle(
  cwd: string,
  observedAt = new Date(),
): NodeLifecycleObservation {
  const source = 'nodejs/Release schedule' as const;
  const timestamp = observedAt.toISOString();
  const script =
    "const r=await fetch('https://raw.githubusercontent.com/nodejs/Release/main/schedule.json');if(!r.ok)throw new Error('HTTP '+r.status);process.stdout.write(await r.text())";
  const result = runBoundedCommand('node', ['--input-type=module', '--eval', script], cwd, {
    timeoutMs: 10_000,
  });
  if (result.state !== 'passed') {
    return {
      source,
      observedAt: timestamp,
      state: 'unavailable',
      lines: [],
      details: result.stderr,
    };
  }
  try {
    const schedule = JSON.parse(result.stdout) as Readonly<Record<string, ScheduleEntry>>;
    return {
      source,
      observedAt: timestamp,
      state: 'available',
      lines: normalizeNodeSchedule(schedule, observedAt),
    };
  } catch {
    return {
      source,
      observedAt: timestamp,
      state: 'unavailable',
      lines: [],
      details: 'The published Node schedule was invalid.',
    };
  }
}
