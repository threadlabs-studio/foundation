import { defineModule } from './factory.js';

export const generatedArtifactsModule = defineModule({
  id: 'generated-artifacts',
  title: 'Generated artifacts',
  description: 'Explicit generation ownership and drift checks.',
  failureClass: 'generated-source-drift',
  applicability: 'Repositories that commit or consume generated output.',
  expectedSeconds: 15,
  artifacts: [
    { path: '.gitattributes', ownership: 'managed', template: 'generated/gitattributes' },
  ],
});
