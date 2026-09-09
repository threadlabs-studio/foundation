import { defineModule } from './factory.js';

export const agentsModule = defineModule({
  id: 'agents',
  title: 'Coding-agent guidance',
  description: 'A concise cross-tool contract for safe prompt-driven development.',
  failureClass: 'agent-completion-without-authoritative-evidence',
  applicability: 'Repositories developed with coding agents.',
  lane: 'inner',
  expectedSeconds: 1,
  artifacts: [
    { path: 'AGENTS.md', ownership: 'managed', template: 'agents/root' },
    { path: 'CLAUDE.md', ownership: 'managed', template: 'agents/claude' },
  ],
});
