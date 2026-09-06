import { defineModule } from './factory.js';

export const npmPublishModule = defineModule({
  id: 'npm-publish',
  title: 'npm publishing',
  description: 'Protected OIDC publication with package and version integrity checks.',
  failureClass: 'unverified-or-untraceable-package-publication',
  applicability: 'Packages intended for publication to npm.',
  lane: 'release',
  expectedSeconds: 240,
  dependencies: ['core', 'typescript-node', 'github'],
  artifacts: [{ path: 'CHANGELOG.md', ownership: 'managed', template: 'npm/changelog' }],
});
