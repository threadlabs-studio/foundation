import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

import { validateManagedPath } from '../domain/config.js';

export function assertSafeTarget(root: string, path: string): string {
  const issues = validateManagedPath(path);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(' '));
  const physicalRoot = realpathSync(root);
  const target = resolve(physicalRoot, path);
  const relativeTarget = relative(physicalRoot, target);
  if (relativeTarget.startsWith(`..${sep}`) || relativeTarget === '..') {
    throw new Error(`Managed target escapes the repository root: ${path}`);
  }

  const parent = dirname(target);
  const relativeParent = relative(physicalRoot, parent);
  let cursor = physicalRoot;
  for (const segment of relativeParent.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink())
      throw new Error(`Managed path traverses a symlink: ${path}`);
  }
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    throw new Error(`Managed target is a symlink: ${path}`);
  }
  return target;
}
