import { defineModule } from './factory.js';

export const codeDocumentationModule = defineModule({
  id: 'code-documentation',
  title: 'Explanatory code documentation',
  description:
    'Durable explanations for implementation invariants, algorithms, platform boundaries, and consequential tradeoffs.',
  failureClass: 'implementation-knowledge-loss',
  applicability: 'Public repositories with non-obvious implementation decisions or reusable APIs.',
  lane: 'inner',
  expectedSeconds: 2,
  artifacts: [
    {
      path: 'docs/code-documentation-standard.md',
      ownership: 'managed',
      template: 'code-documentation/standard',
    },
  ],
});
