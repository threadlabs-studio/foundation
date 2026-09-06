import { defineModule } from './factory.js';

export const freshnessModule = defineModule({
  id: 'freshness',
  title: 'Dependency freshness',
  description: 'Weekly compatible updates, deliberate majors, and explicit lifecycle status.',
  failureClass: 'silent-dependency-or-runtime-obsolescence',
  applicability: 'Repositories with runtime or development dependencies.',
  lane: 'scheduled',
  expectedSeconds: 60,
  dependencies: ['core', 'github'],
  artifacts: [
    { path: '.github/dependabot.yml', ownership: 'managed', template: 'github/dependabot' },
  ],
});
