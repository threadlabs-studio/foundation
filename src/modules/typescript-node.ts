import { defineModule } from './factory.js';

export const typescriptNodeModule = defineModule({
  id: 'typescript-node',
  title: 'TypeScript and Node',
  description: 'Strict ESM TypeScript library tooling on maintained Node LTS lines.',
  failureClass: 'runtime-or-type-drift',
  applicability: 'Node libraries and command-line tools written in TypeScript.',
  lane: 'inner',
  expectedSeconds: 45,
  artifacts: [
    { path: 'package.json', ownership: 'managed', template: 'typescript/package-json' },
    { path: 'pnpm-workspace.yaml', ownership: 'managed', template: 'typescript/pnpm-workspace' },
    { path: 'tsconfig.json', ownership: 'managed', template: 'typescript/tsconfig' },
    { path: 'tsconfig.build.json', ownership: 'managed', template: 'typescript/tsconfig-build' },
    { path: 'oxlint.json', ownership: 'managed', template: 'typescript/oxlint' },
    { path: 'prettier.config.mjs', ownership: 'managed', template: 'typescript/prettier' },
    { path: 'vitest.config.ts', ownership: 'managed', template: 'typescript/vitest' },
    { path: 'src/index.ts', ownership: 'managed', template: 'typescript/index' },
    { path: 'tests/index.test.ts', ownership: 'managed', template: 'typescript/test' },
  ],
});
