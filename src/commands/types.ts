import type { ExitClass } from '../domain/errors.js';

export interface CommandResult {
  readonly command: string;
  readonly status: 'success' | 'findings' | 'invalid-input' | 'blocked' | 'canceled' | 'failed';
  readonly exitClass: ExitClass;
  readonly summary: string;
  readonly data: unknown;
}

export interface CommandOptions {
  readonly root: string;
  readonly values: Readonly<Record<string, string | boolean | string[] | undefined>>;
  readonly subject?: string;
}
