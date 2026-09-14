#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { runPrompt } from './commands/prompt.js';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

const program = new Command()
  .name('callitto')
  .description('A second life for your words.')
  .version(packageJson.version)
  .argument('<prompt>', 'Your raw prompt')
  .allowExcessArguments(false)
  .action(runPrompt);

try {
  await program.parseAsync();
} catch (error) {
  console.error(
    `Error: ${error instanceof Error ? error.message : 'Command failed.'}`,
  );
  process.exitCode = 1;
}
