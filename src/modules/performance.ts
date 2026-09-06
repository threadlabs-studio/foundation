import { defineModule } from './factory.js';

export const performanceModule = defineModule({
  id: 'performance',
  title: 'Performance sensitivity',
  description: 'Calibrated evidence for code paths with explicit latency or memory budgets.',
  failureClass: 'material-performance-regression',
  applicability: 'Projects with measured performance-sensitive behavior.',
  lane: 'extended',
  expectedSeconds: 600,
});
