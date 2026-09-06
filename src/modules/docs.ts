import { defineModule } from './factory.js';

export const docsModule = defineModule({
  id: 'docs',
  title: 'Documentation sites',
  description: 'Documentation build and link confidence for published project sites.',
  failureClass: 'published-documentation-regression',
  applicability: 'Repositories that publish a documentation site.',
  lane: 'extended',
  expectedSeconds: 120,
  artifacts: [{ path: 'docs/README.md', ownership: 'managed', template: 'docs/readme' }],
});
