import { defineModule } from './factory.js';

export const coreModule = defineModule({
  id: 'core',
  title: 'Core repository policy',
  description: 'Portable project identity, contribution basics, and safe defaults.',
  failureClass: 'missing-repository-contract',
  applicability: 'Every managed repository.',
  lane: 'inner',
  expectedSeconds: 1,
  artifacts: [
    { path: '.gitignore', ownership: 'managed', template: 'core/gitignore' },
    { path: 'LICENSE', ownership: 'managed', template: 'core/license-mit' },
    { path: 'README.md', ownership: 'managed', template: 'core/readme' },
  ],
});
