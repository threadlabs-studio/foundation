import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export interface RepositorySnapshot {
  readonly files: ReadonlyMap<string, string>;
  readonly symlinks: readonly string[];
  readonly caseCollisions: readonly (readonly [string, string])[];
}

const ignoredDirectories = new Set(['.git', '.threadlabs', 'coverage', 'dist', 'node_modules']);

export function snapshotRepository(root: string): RepositorySnapshot {
  const physicalRoot = realpathSync(root);
  const files = new Map<string, string>();
  const symlinks: string[] = [];
  const lowerCasePaths = new Map<string, string>();
  const caseCollisions: Array<readonly [string, string]> = [];

  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const absolute = resolve(directory, entry.name);
      const path = relative(physicalRoot, absolute).split('\\').join('/');
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        symlinks.push(path);
        continue;
      }
      const previous = lowerCasePaths.get(path.toLowerCase());
      if (previous !== undefined && previous !== path) caseCollisions.push([previous, path]);
      else lowerCasePaths.set(path.toLowerCase(), path);
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isFile()) files.set(path, readFileSync(absolute, 'utf8'));
    }
  };

  visit(physicalRoot);
  return { files, symlinks: symlinks.toSorted(), caseCollisions };
}
