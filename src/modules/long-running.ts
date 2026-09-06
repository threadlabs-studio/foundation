import { defineModule } from './factory.js';

export const longRunningModule = defineModule({
  id: 'long-running',
  title: 'Long-running verification',
  description: 'Scheduled placement for exhaustive or noisy confidence checks.',
  failureClass: 'escaped-defect-outside-pr-budget',
  applicability: 'Projects with exhaustive checks that do not justify per-PR cost.',
  lane: 'scheduled',
  expectedSeconds: 900,
});
