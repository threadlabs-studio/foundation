import { defineModule } from './factory.js';

export const publicApiModule = defineModule({
  id: 'public-api',
  title: 'Public API compatibility',
  description: 'Consumer-level import and packaging contracts for reusable libraries.',
  failureClass: 'published-api-or-package-regression',
  applicability: 'Libraries exposing imports or executable entry points.',
  expectedSeconds: 30,
  dependencies: ['core', 'typescript-node'],
  artifacts: [
    {
      path: 'tests/package.test.ts',
      ownership: 'managed',
      template: 'public-api/package-test',
    },
  ],
});
