import { defineModule } from './factory.js';

export const crossPlatformModule = defineModule({
  id: 'cross-platform',
  title: 'Cross-platform behavior',
  description: 'Risk-triggered operating-system compatibility evidence.',
  failureClass: 'platform-specific-regression',
  applicability: 'Projects with platform-sensitive filesystem, process, or shell behavior.',
  lane: 'extended',
  expectedSeconds: 600,
  artifacts: [
    {
      path: '.github/workflows/extended.yml',
      ownership: 'managed',
      template: 'github/cross-platform',
    },
  ],
});
