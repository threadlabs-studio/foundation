import { createHash } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';

import { digestCanonical } from '../domain/canonicalize.js';

export function hashContent(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

export function fingerprintRoot(root: string): string {
  const physical = realpathSync(root);
  const stat = statSync(physical);
  return digestCanonical({ physical, device: stat.dev, inode: stat.ino });
}
