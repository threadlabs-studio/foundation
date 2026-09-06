import { defineModule } from './factory.js';

export const browserModule = defineModule({
  id: 'browser',
  title: 'Browser behavior',
  description: 'Risk-triggered real-browser evidence for user-facing flows.',
  failureClass: 'browser-integration-regression',
  applicability: 'Projects whose contract includes browser behavior.',
  lane: 'extended',
  expectedSeconds: 480,
});
