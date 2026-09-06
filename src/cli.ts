#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export interface CliIo {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

const helpText = `Threadlabs

Usage: threadlabs [command]

Commands:
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

  io.stderr(`Unknown command: ${command}\nRun "threadlabs --help" for usage.\n`);
  return 2;
}

const invokedPath = process.argv[1];

if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(realpathSync(invokedPath)).href
) {
  process.exitCode = runCli(process.argv.slice(2));
}
