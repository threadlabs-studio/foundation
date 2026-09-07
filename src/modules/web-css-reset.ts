import { defineModule } from './factory.js';

export const webCssResetModule = defineModule({
  id: 'web-css-reset',
  title: 'Web CSS reset',
  description:
    'A conservative, low-specificity reset for native document elements that leaves custom-element hosts intact.',
  failureClass: 'cross-browser-css-default-drift',
  applicability: 'Web applications and sites that own a global author stylesheet.',
  expectedSeconds: 5,
  artifacts: [
    {
      path: 'src/styles/reset.css',
      ownership: 'managed',
      template: 'web/reset-css',
    },
  ],
});
