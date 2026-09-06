import type { ModuleBundle } from '../domain/module.js';

export const TYPESCRIPT_LIBRARY_BUNDLE: ModuleBundle = {
  id: 'typescript-library',
  title: 'TypeScript library',
  description: 'Recommended first-green baseline for a public TypeScript package.',
  modules: [
    'core',
    'typescript-node',
    'github',
    'freshness',
    'agents',
    'public-api',
    'generated-artifacts',
    'npm-publish',
  ],
};

export const BUILT_IN_BUNDLES = [TYPESCRIPT_LIBRARY_BUNDLE] as const;
