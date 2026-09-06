import type { RepositorySnapshot } from '../adapters/filesystem.js';

export function inferModules(snapshot: RepositorySnapshot): readonly string[] {
  const packageJson = snapshot.files.get('package.json');
  const hasTypeScript =
    snapshot.files.has('tsconfig.json') ||
    (packageJson !== undefined && /["']typescript["']/u.test(packageJson));
  const modules = new Set(['core', 'agents']);
  if (hasTypeScript || snapshot.files.size === 0) {
    [
      'typescript-node',
      'github',
      'freshness',
      'public-api',
      'generated-artifacts',
      'npm-publish',
    ].forEach((module) => modules.add(module));
  } else if ([...snapshot.files.keys()].some((path) => path.startsWith('.github/'))) {
    modules.add('github');
  }
  return [...modules].toSorted();
}
