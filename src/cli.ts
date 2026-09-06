#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { dispatchCommand } from './commands/dispatch.js';
import type { CommandResult } from './commands/types.js';
import { EXIT_CODES } from './domain/errors.js';
import { presentHuman } from './presenters/human.js';
import { enrichInteractiveArguments } from './presenters/interactive.js';
import { presentJson } from './presenters/json.js';

export interface CliIo {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

const helpText = `Threadlabs

Usage: threadlabs [command]

Commands:
  init         Preview a new-project baseline (audit-first for nonempty targets)
  audit        Inspect a repository without writes
  plan         Preview changes for an existing manifest
  apply        Apply an approved local plan and digest
  status       Show managed and recovery state
  resume       Resume an interrupted approved plan
  upgrade      Preview a standard-version upgrade
  explain      Explain modules and their controls
  clean        Remove saved preview plans (journals are retained)
  verify       Run a bounded verification lane and emit evidence
  freshness    Report dependency update and lifecycle states
  github       Audit, plan, or separately apply GitHub settings
  help         Show this help

Options:
  -h, --help   Show this help
`;

const processIo: CliIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};

export function runCli(arguments_: readonly string[], io: CliIo = processIo): number {
  const [command] = arguments_;

  if (command === undefined || command === 'help' || command === '-h' || command === '--help') {
    io.stdout(helpText);
    return 0;
  }

  const known = new Set([
    'init',
    'audit',
    'plan',
    'apply',
    'status',
    'resume',
    'upgrade',
    'explain',
    'clean',
    'verify',
    'freshness',
    'github',
  ]);
  if (!known.has(command)) {
    io.stderr(`Unknown command: ${command}\nRun "threadlabs --help" for usage.\n`);
    return 2;
  }

  const jsonMode = arguments_.includes('--json');
  let result: CommandResult;
  try {
    const parsed = parseArgs({
      args: arguments_.slice(1),
      allowPositionals: true,
      strict: true,
      options: {
        json: { type: 'boolean' },
        yes: { type: 'boolean' },
        check: { type: 'boolean' },
        name: { type: 'string' },
        description: { type: 'string' },
        owner: { type: 'string' },
        config: { type: 'string' },
        bundle: { type: 'string', multiple: true },
        module: { type: 'string', multiple: true },
        plan: { type: 'string' },
        digest: { type: 'string' },
        stage: { type: 'string' },
        lane: { type: 'string' },
        offline: { type: 'boolean' },
        repository: { type: 'string' },
        action: { type: 'string' },
        collaborative: { type: 'boolean' },
        'remote-approve': { type: 'boolean' },
      },
    });
    const subject = parsed.positionals[0];
    const root = resolve(command === 'explain' ? '.' : (subject ?? '.'));
    result = dispatchCommand(command, {
      root,
      values: parsed.values,
      ...(command === 'explain' && subject !== undefined ? { subject } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown failure.';
    result = {
      command,
      status: /digest|preimage|fingerprint|symlink|ambiguous/iu.test(message)
        ? 'blocked'
        : 'invalid-input',
      exitClass: /digest|preimage|fingerprint|symlink|ambiguous/iu.test(message)
        ? 'staleOrConflict'
        : 'invalidInput',
      summary: message,
      data: { message },
    };
  }
  if (jsonMode) io.stdout(presentJson(result));
  else if (result.exitClass === 'success' || result.exitClass === 'findings')
    io.stdout(presentHuman(result));
  else io.stderr(presentHuman(result));
  return EXIT_CODES[result.exitClass];
}

const invokedPath = process.argv[1];

if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(realpathSync(invokedPath)).href
) {
  process.exitCode = runCli(await enrichInteractiveArguments(process.argv.slice(2)));
}
