import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

import { assertSafeTarget } from '../engine/ownership.js';

export function atomicWriteFile(root: string, path: string, content: string): void {
  const target = assertSafeTarget(root, path);
  mkdirSync(dirname(target), { recursive: true });
  assertSafeTarget(root, path);
  const temporary = `${target}.threadlabs-${process.pid}-${crypto.randomUUID()}.tmp`;
  const descriptor = openSync(temporary, 'wx', 0o600);
  try {
    writeFileSync(descriptor, content, 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  try {
    assertSafeTarget(root, path);
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
