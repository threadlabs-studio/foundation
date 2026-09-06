import { defineModule } from './factory.js';

export const githubModule = defineModule({
  id: 'github',
  title: 'GitHub collaboration',
  description: 'Stable CI checks and review-oriented repository policy.',
  failureClass: 'unreviewed-or-unverified-default-branch-change',
  applicability: 'Repositories hosted on GitHub.',
  expectedSeconds: 180,
  capabilities: ['local-files', 'github-read', 'github-write'],
  artifacts: [{ path: '.github/workflows/ci.yml', ownership: 'managed', template: 'github/ci' }],
});
