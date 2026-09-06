import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { JournalEvent } from '../domain/operation.js';

export function journalPath(root: string, planDigest: string): string {
  return join(root, '.threadlabs', 'operations', `${planDigest}.jsonl`);
}

export function readJournal(root: string, planDigest: string): readonly JournalEvent[] {
  const path = journalPath(root, planDigest);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JournalEvent);
}

export function appendJournal(root: string, event: JournalEvent): void {
  const path = journalPath(root, event.planDigest);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 });
}
