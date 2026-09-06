import type { Observation } from './observation.js';

export type OperationState = 'pending' | 'running' | 'succeeded' | 'failed' | 'blocked' | 'skipped';
export type EffectScope = 'local' | 'remote';

export interface LocalWriteEffect {
  readonly id: string;
  readonly scope: 'local';
  readonly kind: 'write-file';
  readonly path: string;
  readonly content: string;
  readonly expectedPreimage: string | null;
  readonly postconditionDigest: string;
}

export interface RemoteSettingEffect {
  readonly id: string;
  readonly scope: 'remote';
  readonly kind: 'github-setting';
  readonly repository: string;
  readonly setting: string;
  readonly expectedValue: unknown;
  readonly desiredValue: unknown;
}

export type OperationEffect = LocalWriteEffect | RemoteSettingEffect;

export interface OperationPlan {
  readonly schemaVersion: '1.0';
  readonly standardVersion: string;
  readonly targetRoot: '.';
  readonly targetFingerprint: string;
  readonly manifestDigest: string;
  readonly lockDigest: string | null;
  readonly stage: string;
  readonly observations: readonly Observation[];
  readonly localEffects: readonly LocalWriteEffect[];
  readonly remoteEffects: readonly RemoteSettingEffect[];
  readonly postconditions: readonly string[];
}

export interface JournalEvent {
  readonly runId: string;
  readonly planDigest: string;
  readonly effectId: string;
  readonly state: OperationState;
  readonly recordedAt: string;
  readonly requestFingerprint?: string;
  readonly responseClass?: string;
  readonly postcondition?: string;
}
