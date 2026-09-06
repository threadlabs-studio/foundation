export type FreshnessState =
  | 'current'
  | 'update-available'
  | 'major-update'
  | 'security-blocked'
  | 'eol'
  | 'prerelease'
  | 'intentionally-held'
  | 'update-failed'
  | 'stale'
  | 'unknown';

export interface FreshnessInput {
  readonly current: string;
  readonly latest?: string;
  readonly securityBlocked?: boolean;
  readonly eol?: boolean;
  readonly heldReason?: string;
  readonly failed?: boolean;
  readonly stale?: boolean;
}

export interface FreshnessResult extends FreshnessInput {
  readonly state: FreshnessState;
}

function major(version: string): number | undefined {
  const match = /^(?:\D*)(\d+)/u.exec(version);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

export function classifyFreshness(input: FreshnessInput): FreshnessResult {
  let state: FreshnessState;
  if (input.failed === true) state = 'update-failed';
  else if (input.stale === true) state = 'stale';
  else if (input.securityBlocked === true) state = 'security-blocked';
  else if (input.eol === true) state = 'eol';
  else if (input.heldReason !== undefined) state = 'intentionally-held';
  else if (input.current.includes('-')) state = 'prerelease';
  else if (input.latest === undefined) state = 'unknown';
  else if (input.current === input.latest) state = 'current';
  else if (major(input.current) !== major(input.latest)) state = 'major-update';
  else state = 'update-available';
  return { ...input, state };
}
